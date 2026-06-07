import { and, desc, eq, isNull, lte, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks, pollingJobs } from "@/lib/db/schema";
import type { DebridItemStatus } from "@/lib/debrid";
import { env } from "@/lib/server/env";
import { createAuthenticatedRealDebridClient } from "@/lib/server/real-debrid/auth-service";
import { RealDebridApiError, RealDebridClient } from "@/lib/server/real-debrid/client";
import type {
  RealDebridTorrent,
  RealDebridTorrentStatus,
  UnrestrictLinkResponse,
} from "@/lib/server/real-debrid/types";

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

    const client = await createAuthenticatedRealDebridClient();

    for (const job of jobs) {
      summary.checked += 1;
      const result = await pollOneJob(job, client, now);
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

async function pollOneJob(
  job: PollingJobRow,
  client: RealDebridClient,
  now: Date,
): Promise<"completed" | "rescheduled" | "failed"> {
  const [item] = await db
    .select()
    .from(debridItems)
    .where(eq(debridItems.id, job.debridItemId))
    .limit(1);

  if (!item || item.status === "deleted") {
    await finishJob(job.id, "cancelled", now);
    return "completed";
  }

  if (!item.realDebridTorrentId) {
    await markJobError(job, item, "Missing Real-Debrid torrent id.", now);
    return "failed";
  }

  await db
    .update(pollingJobs)
    .set({ lockedAt: now, lockToken: crypto.randomUUID(), updatedAt: now })
    .where(eq(pollingJobs.id, job.id));

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
