import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks } from "@/lib/db/schema";
import {
  type AddToDebridRequest,
  type AddToDebridResponse,
  type DebridItemStatus,
} from "@/lib/debrid";
import { resolveInfoHash, upsertMediaItem } from "@/lib/server/media-items";
import {
  createAuthenticatedRealDebridClient,
  getLatestRealDebridAccount,
} from "@/lib/server/real-debrid/auth-service";
import { RealDebridClient } from "@/lib/server/real-debrid/client";
import { toAvailability } from "@/lib/server/real-debrid/availability";
import { enqueueDebridPolling, refreshDebridLinks } from "@/lib/server/real-debrid/poller";
import type {
  RealDebridTorrent,
  RealDebridTorrentStatus,
} from "@/lib/server/real-debrid/types";

/** Number of times we re-poll a freshly-added magnet to reach file selection. */
const FILE_SELECTION_ATTEMPTS = 4;
const FILE_SELECTION_DELAY_MS = 750;

export class AddToDebridError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AddToDebridError";
  }
}

/**
 * Sends a search result to Real-Debrid and records local tracking state.
 *
 * Idempotent: if the torrent is already tracked and downloadable we return its
 * current state instead of re-adding (so the UI can offer Download); if it is
 * mid-flight we return progress without touching Real-Debrid. Otherwise we add
 * the magnet, wait briefly for file selection, select all files, and persist
 * the Real-Debrid torrent id, status, and progress.
 */
export async function addSearchResultToDebrid(
  input: AddToDebridRequest,
): Promise<AddToDebridResponse> {
  const infoHash = resolveInfoHash(input);
  const magnet = input.magnetUrl ?? buildMagnetUri(infoHash, input.title);

  if (!magnet) {
    throw new AddToDebridError("This result has no magnet link or info hash to add.");
  }

  const mediaItem = await upsertMediaItem(input, infoHash);
  const existing = await findDebridItem(mediaItem.id);

  // Already downloadable or actively working — don't re-add. If a ready item is
  // missing its links (e.g. added before they were created, or the poller never
  // ran), backfill them now so re-clicking Add surfaces Play/Download.
  if (existing && existing.status !== "error" && existing.status !== "deleted") {
    if (existing.status === "ready" && existing.realDebridTorrentId) {
      await backfillLinksIfMissing(existing.id, existing.realDebridTorrentId);
    }
    return toResponse(mediaItem.id, existing, true);
  }

  const account = await getLatestRealDebridAccount();
  const client = await createAuthenticatedRealDebridClient();

  // Mark as adding up front so a slow Real-Debrid round-trip still surfaces a
  // tracked item (and the Added page reflects it) if the request is retried.
  await upsertDebridItem(mediaItem.id, account?.id ?? null, {
    status: "adding",
    progress: 0,
    realDebridTorrentId: null,
    errorMessage: null,
    addedToDebridAt: new Date(),
  });

  let torrent: RealDebridTorrent;
  try {
    const { id: torrentId } = await client.addMagnet(magnet);
    torrent = await selectFilesWhenReady(client, torrentId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add to Real-Debrid.";
    const failed = await upsertDebridItem(mediaItem.id, account?.id ?? null, {
      status: "error",
      errorMessage: message,
    });
    throw new AddToDebridError(message, { cause: failed });
  }

  const status = mapTorrentStatus(torrent.status);
  const saved = await upsertDebridItem(mediaItem.id, account?.id ?? null, {
    realDebridTorrentId: torrent.id,
    status,
    progress: clampProgress(torrent.progress),
    selectedFileIds: [],
    files: [],
    errorMessage: status === "error" ? "Real-Debrid reported an error." : null,
    completedAt: status === "ready" ? new Date() : null,
  });

  // A cached torrent is often already "downloaded" at add time; create its links
  // now so the Added page shows Play/Download immediately instead of waiting for
  // the background poller. Fall back to polling if links aren't ready yet.
  if (status === "ready") {
    const linkCount = await refreshDebridLinks(saved.id, torrent, client);
    if (linkCount === 0) {
      await enqueueDebridPolling(saved.id);
    }
  } else if (status !== "error") {
    await enqueueDebridPolling(saved.id);
  }

  return { ...toResponse(mediaItem.id, saved, false), filename: torrent.filename };
}

/**
 * Polls the torrent until Real-Debrid is ready to accept file selection, then
 * selects all files. Real-Debrid briefly reports `magnet_conversion` before
 * `waiting_files_selection`; for cached torrents this is near-instant. If it
 * never settles in the allotted attempts we return the latest torrent state and
 * leave selection to the background poller (a later phase).
 */
async function selectFilesWhenReady(
  client: RealDebridClient,
  torrentId: string,
): Promise<RealDebridTorrent> {
  let torrent = await client.getTorrent(torrentId);

  for (let attempt = 0; attempt < FILE_SELECTION_ATTEMPTS; attempt += 1) {
    if (torrent.status === "waiting_files_selection") {
      await client.selectAllFiles(torrentId);
      return client.getTorrent(torrentId);
    }

    if (torrent.status !== "magnet_conversion") {
      return torrent;
    }

    await sleep(FILE_SELECTION_DELAY_MS);
    torrent = await client.getTorrent(torrentId);
  }

  return torrent;
}

/**
 * Ensures a ready item has its {@link debridLinks}, creating them from the
 * Real-Debrid torrent if absent. No-op when links already exist or the torrent
 * is gone. Best-effort — failures don't block returning the reused item.
 */
async function backfillLinksIfMissing(
  debridItemId: string,
  torrentId: string,
): Promise<void> {
  const [{ value: linkCount } = { value: 0 }] = await db
    .select({ value: count() })
    .from(debridLinks)
    .where(eq(debridLinks.debridItemId, debridItemId));

  if (linkCount > 0) {
    return;
  }

  try {
    const client = await createAuthenticatedRealDebridClient();
    const torrent = await client.getTorrent(torrentId);
    await refreshDebridLinks(debridItemId, torrent, client);
  } catch {
    // Leave links empty; the Added page still shows the item, and a later
    // poll or re-add can fill them in.
  }
}

type DebridItemRow = typeof debridItems.$inferSelect;

async function findDebridItem(mediaItemId: string): Promise<DebridItemRow | undefined> {
  const [row] = await db
    .select()
    .from(debridItems)
    .where(eq(debridItems.mediaItemId, mediaItemId))
    .limit(1);

  return row;
}

type DebridItemPatch = Partial<typeof debridItems.$inferInsert>;

/** Inserts or updates the single debrid_item for a media item (unique per item). */
async function upsertDebridItem(
  mediaItemId: string,
  realDebridAccountId: string | null,
  patch: DebridItemPatch,
): Promise<DebridItemRow> {
  const existing = await findDebridItem(mediaItemId);

  if (existing) {
    const [updated] = await db
      .update(debridItems)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(debridItems.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(debridItems)
    .values({ mediaItemId, realDebridAccountId, ...patch })
    .returning();

  return created;
}

function toResponse(
  mediaItemId: string,
  row: DebridItemRow,
  reused: boolean,
): AddToDebridResponse {
  return {
    mediaItemId,
    debridItemId: row.id,
    torrentId: row.realDebridTorrentId,
    status: row.status,
    availability: toAvailability(row.status),
    progress: row.progress,
    reused,
  };
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

/** Synthesizes a magnet URI for results that only carry an info hash. */
function buildMagnetUri(infoHash: string | null, title: string): string | null {
  if (!infoHash) {
    return null;
  }

  const params = new URLSearchParams({ dn: title });
  return `magnet:?xt=urn:btih:${infoHash}&${params.toString()}`;
}

function clampProgress(progress: number | undefined): number {
  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
