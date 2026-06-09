import path from "node:path";

import { and, desc, eq, isNull, lte, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks, mediaItems, pollingJobs } from "@/lib/db/schema";
import type { DebridItemStatus } from "@/lib/debrid";
import { env } from "@/lib/server/env";
import { createAuthenticatedRealDebridClient } from "@/lib/server/real-debrid/auth-service";
import { RealDebridApiError, RealDebridClient } from "@/lib/server/real-debrid/client";
import type {
  RealDebridTorrent,
  RealDebridTorrentStatus,
  UnrestrictLinkResponse,
} from "@/lib/server/real-debrid/types";
import {
  isQbCompleted,
  isQbErrored,
  QBittorrentClient,
  type QbFile,
  type QbTorrent,
} from "@/lib/server/torrents/qbittorrent";

const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const STALE_LOCK_MS = 2 * 60_000;

type RedisLockClient = {
  set: (
    key: string,
    value: string,
    options: { NX: true; PX: number },
  ) => Promise<string | null>;
  get?: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
};

type PollOptions = {
  limit?: number;
  now?: Date;
  redis?: RedisLockClient;
  lockTtlMs?: number;
};

export type PollSummary = {
  checked: number;
  completed: number;
  rescheduled: number;
  failed: number;
};

type PollingJobRow = typeof pollingJobs.$inferSelect;
type DebridItemRow = typeof debridItems.$inferSelect;

/**
 * Ensures a debrid item will be picked up by the background poller. The DB row
 * is durable; Redis is used by the worker to coordinate active poll passes.
 */
export async function enqueueDebridPolling(
  debridItemId: string,
  nextPollAt: Date = new Date(),
) {
  const [existing] = await db
    .select()
    .from(pollingJobs)
    .where(eq(pollingJobs.debridItemId, debridItemId))
    .limit(1);

  if (existing) {
    await db
      .update(pollingJobs)
      .set({
        status: "active",
        nextPollAt,
        lockedAt: null,
        lockToken: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(pollingJobs.id, existing.id));
    return;
  }

  await db.insert(pollingJobs).values({ debridItemId, nextPollAt });
}

export async function pollDueDebridItems({
  limit = 10,
  now = new Date(),
  redis,
  lockTtlMs = 30_000,
}: PollOptions = {}): Promise<PollSummary> {
  const lockToken = crypto.randomUUID();
  const lockKey = "dmaga:real-debrid:poller";
  const acquired = redis
    ? await redis.set(lockKey, lockToken, { NX: true, PX: lockTtlMs })
    : "OK";

  if (!acquired) {
    return { checked: 0, completed: 0, rescheduled: 0, failed: 0 };
  }

  try {
    const jobs = await findDueJobs(now, limit);
    const summary: PollSummary = {
      checked: 0,
      completed: 0,
      rescheduled: 0,
      failed: 0,
    };

    if (jobs.length === 0) {
      return summary;
    }

    // Resolve the Real-Debrid client lazily and once: a queue of only
    // torrent-provider items must not require an RD account to exist.
    let rdClient: RealDebridClient | undefined;
    const getRdClient = async () => {
      rdClient ??= await createAuthenticatedRealDebridClient();
      return rdClient;
    };

    for (const job of jobs) {
      summary.checked += 1;
      const result = await pollOneJob(job, getRdClient, now);
      summary[result] += 1;
    }

    return summary;
  } finally {
    if (redis) {
      await releaseLock(redis, lockKey, lockToken);
    }
  }
}

async function releaseLock(redis: RedisLockClient, lockKey: string, lockToken: string) {
  if (redis.get) {
    const currentToken = await redis.get(lockKey);
    if (currentToken !== lockToken) {
      return;
    }
  }

  await redis.del(lockKey);
}

async function findDueJobs(now: Date, limit: number) {
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const unlockedOrStale: SQL | undefined = or(
    isNull(pollingJobs.lockedAt),
    lte(pollingJobs.lockedAt, staleBefore),
  );

  return db
    .select()
    .from(pollingJobs)
    .where(
      and(
        eq(pollingJobs.status, "active"),
        lte(pollingJobs.nextPollAt, now),
        unlockedOrStale,
      ),
    )
    .orderBy(desc(pollingJobs.nextPollAt))
    .limit(limit);
}

type PollOutcome = "completed" | "rescheduled" | "failed";

async function pollOneJob(
  job: PollingJobRow,
  getRdClient: () => Promise<RealDebridClient>,
  now: Date,
): Promise<PollOutcome> {
  const [item] = await db
    .select()
    .from(debridItems)
    .where(eq(debridItems.id, job.debridItemId))
    .limit(1);

  if (!item || item.status === "deleted") {
    await finishJob(job.id, "cancelled", now);
    return "completed";
  }

  await db
    .update(pollingJobs)
    .set({ lockedAt: now, lockToken: crypto.randomUUID(), updatedAt: now })
    .where(eq(pollingJobs.id, job.id));

  if (item.provider === "torrent") {
    return pollTorrentJob(job, item, now);
  }

  if (!item.realDebridTorrentId) {
    await markJobError(job, item, "Missing Real-Debrid torrent id.", now);
    return "failed";
  }

  const client = await getRdClient();
  try {
    const torrent = await getSelectableTorrent(client, item.realDebridTorrentId);
    const status = mapTorrentStatus(torrent.status);
    const progress = clampProgress(torrent.progress);

    await db
      .update(debridItems)
      .set({
        status,
        progress,
        files: torrent.links?.map((link) => ({ link })) ?? [],
        errorMessage: status === "error" ? "Real-Debrid reported an error." : null,
        completedAt: status === "ready" ? now : item.completedAt,
        updatedAt: now,
      })
      .where(eq(debridItems.id, item.id));

    if (status === "ready") {
      await refreshDebridLinks(item.id, torrent, client);
      await finishJob(job.id, "complete", now);
      return "completed";
    }

    if (status === "error") {
      await finishJob(job.id, "error", now, "Real-Debrid reported an error.");
      return "failed";
    }

    await rescheduleJob(job, now);
    return "rescheduled";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to poll Real-Debrid item.";

    if (error instanceof RealDebridApiError && error.status === 404) {
      await db
        .update(debridItems)
        .set({
          status: "deleted",
          progress: 0,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(debridItems.id, item.id));
      await finishJob(job.id, "cancelled", now);
      return "completed";
    }

    await markJobError(job, item, message, now);
    return "failed";
  }
}

/**
 * Polls a `torrent`-provider item against qBittorrent: maps the torrent's state
 * to our status, and on completion writes {@link debridLinks} pointing at the
 * files on disk (so the local file-serving route can stream them). Looks up the
 * info hash from the linked media item — that's the qBittorrent torrent handle.
 */
async function pollTorrentJob(
  job: PollingJobRow,
  item: DebridItemRow,
  now: Date,
): Promise<PollOutcome> {
  const [media] = await db
    .select({ infoHash: mediaItems.infoHash })
    .from(mediaItems)
    .where(eq(mediaItems.id, item.mediaItemId))
    .limit(1);

  const infoHash = media?.infoHash;
  if (!infoHash) {
    await markJobError(job, item, "Missing info hash for torrent item.", now);
    return "failed";
  }

  try {
    const client = new QBittorrentClient();
    const torrent = await client.getTorrent(infoHash);

    // Not registered yet (just handed off / still resolving metadata) — retry.
    if (!torrent) {
      await db
        .update(debridItems)
        .set({ status: "adding", updatedAt: now })
        .where(eq(debridItems.id, item.id));
      await rescheduleJob(job, now);
      return "rescheduled";
    }

    const status = mapQbStatus(torrent.state);
    const progress = clampProgress(torrent.progress * 100);

    await db
      .update(debridItems)
      .set({
        status,
        progress,
        errorMessage: status === "error" ? "qBittorrent reported an error." : null,
        completedAt: status === "ready" ? now : item.completedAt,
        updatedAt: now,
      })
      .where(eq(debridItems.id, item.id));

    if (status === "ready") {
      const files = await client.getFiles(infoHash);
      await insertTorrentLinks(item.id, torrent, files);
      await finishJob(job.id, "complete", now);
      return "completed";
    }

    if (status === "error") {
      await finishJob(job.id, "error", now, "qBittorrent reported an error.");
      return "failed";
    }

    await rescheduleJob(job, now);
    return "rescheduled";
  } catch (error) {
    // qBittorrent being briefly unreachable shouldn't permanently fail the
    // item — reschedule (with backoff) and keep its current status.
    const message =
      error instanceof Error ? error.message : "Unable to poll qBittorrent item.";
    await db
      .update(pollingJobs)
      .set({
        attempts: job.attempts + 1,
        nextPollAt: new Date(now.getTime() + backoffMs(job.attempts + 1)),
        lockedAt: null,
        lockToken: null,
        lastError: message,
        updatedAt: now,
      })
      .where(eq(pollingJobs.id, job.id));
    return "rescheduled";
  }
}

/**
 * Replaces an item's links with rows pointing at the torrent's files on disk.
 * `file.name` is relative to the torrent's save path, so the absolute on-disk
 * path is `save_path/name` — valid in the app container since both share the
 * /downloads mount. Returns the number of links created.
 */
async function insertTorrentLinks(
  debridItemId: string,
  torrent: QbTorrent,
  files: QbFile[],
): Promise<number> {
  await db.delete(debridLinks).where(eq(debridLinks.debridItemId, debridItemId));

  if (!files.length) {
    return 0;
  }

  await db.insert(debridLinks).values(
    files.map((file) => {
      const localPath = path.join(torrent.save_path, file.name);
      return {
        debridItemId,
        fileName: path.basename(file.name),
        fileSizeBytes: file.size ?? null,
        host: null,
        originalLink: localPath,
        unrestrictedLink: null,
        localPath,
        mimeType: null,
        streamable: isLikelyVideoFile(file.name),
      } satisfies typeof debridLinks.$inferInsert;
    }),
  );

  return files.length;
}

function mapQbStatus(state: string): DebridItemStatus {
  if (isQbErrored(state)) {
    return "error";
  }
  if (isQbCompleted(state)) {
    return "ready";
  }
  return "downloading";
}

async function getSelectableTorrent(client: RealDebridClient, torrentId: string) {
  let torrent = await client.getTorrent(torrentId);
  if (torrent.status === "waiting_files_selection") {
    await client.selectAllFiles(torrentId);
    torrent = await client.getTorrent(torrentId);
  }
  return torrent;
}

/**
 * Replaces the stored {@link debridLinks} for an item with fresh rows built from
 * the torrent's Real-Debrid links (unrestricting each to capture filename, size
 * and a direct URL). Shared by the poller and the add flow so a torrent that is
 * already cached/ready surfaces playable/downloadable files immediately. Returns
 * the number of links created.
 */
export async function refreshDebridLinks(
  debridItemId: string,
  torrent: RealDebridTorrent,
  client: RealDebridClient,
): Promise<number> {
  const links = torrent.links ?? [];
  await db.delete(debridLinks).where(eq(debridLinks.debridItemId, debridItemId));

  if (!links.length) {
    return 0;
  }

  const unrestricted = await mapWithConcurrency(links, 4, async (link) => {
    try {
      return { originalLink: link, response: await client.unrestrictLink(link) };
    } catch {
      return { originalLink: link, response: null };
    }
  });

  await db
    .insert(debridLinks)
    .values(
      unrestricted.map(({ originalLink, response }) =>
        toDebridLinkInsert(debridItemId, originalLink, response),
      ),
    );

  return links.length;
}

function toDebridLinkInsert(
  debridItemId: string,
  originalLink: string,
  response: UnrestrictLinkResponse | null,
): typeof debridLinks.$inferInsert {
  return {
    debridItemId,
    fileName: response?.filename ?? originalLink,
    fileSizeBytes: response?.filesize ?? null,
    host: response?.host ?? null,
    originalLink,
    unrestrictedLink: response?.download ?? null,
    mimeType: null,
    streamable: isLikelyVideoFile(response?.filename ?? originalLink),
  };
}

function isLikelyVideoFile(fileName: string): boolean {
  return /\.(mkv|mp4|m4v|webm|avi|mov)$/i.test(fileName);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]);
      }
    }),
  );

  return results;
}

async function rescheduleJob(job: PollingJobRow, now: Date) {
  const attempts = job.attempts + 1;
  await db
    .update(pollingJobs)
    .set({
      attempts,
      nextPollAt: new Date(now.getTime() + backoffMs(attempts)),
      lockedAt: null,
      lockToken: null,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(pollingJobs.id, job.id));
}

async function markJobError(
  job: PollingJobRow,
  item: DebridItemRow,
  message: string,
  now: Date,
) {
  await db
    .update(debridItems)
    .set({
      status: "error",
      errorMessage: message,
      updatedAt: now,
    })
    .where(eq(debridItems.id, item.id));

  await finishJob(job.id, "error", now, message);
}

async function finishJob(
  jobId: string,
  status: "complete" | "cancelled" | "error",
  now: Date,
  lastError: string | null = null,
) {
  await db
    .update(pollingJobs)
    .set({
      status,
      lockedAt: null,
      lockToken: null,
      lastError,
      updatedAt: now,
    })
    .where(eq(pollingJobs.id, jobId));
}

function mapTorrentStatus(status: RealDebridTorrentStatus): DebridItemStatus {
  switch (status) {
    case "magnet_conversion":
      return "adding";
    case "waiting_files_selection":
      return "waiting_files_selection";
    case "queued":
      return "queued";
    case "downloading":
    case "compressing":
    case "uploading":
      return "downloading";
    case "downloaded":
      return "ready";
    case "magnet_error":
    case "error":
    case "virus":
    case "dead":
      return "error";
    default:
      return "adding";
  }
}

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(attempts, 5));
}

function clampProgress(progress: number | undefined): number {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
}

export const pollerConfig = {
  redisUrl: env.REDIS_URL,
};
