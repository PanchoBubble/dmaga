import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks } from "@/lib/db/schema";
import type {
  AddToDebridRequest,
  AddToDebridResponse,
  DebridItemStatus,
} from "@/lib/debrid";
import { isReadableMangaFile } from "@/lib/manga";
import { isTorrentFileUrl } from "@/lib/search";
import { env } from "@/lib/server/env";
import { resolveInfoHash, upsertMediaItem } from "@/lib/server/media-items";
import { toAvailability } from "@/lib/server/real-debrid/availability";
import { enqueueDebridPolling } from "@/lib/server/real-debrid/poller";
import { QBittorrentClient, QBittorrentError } from "@/lib/server/torrents/qbittorrent";

/** qBittorrent category applied to everything we add, for easy housekeeping. */
export const TORRENT_CATEGORY = "dmaga";

export class AddTorrentError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "AddTorrentError";
  }
}

/**
 * Non-debrid sibling of {@link addSearchResultToDebrid}: sends a search result
 * to qBittorrent (over the VPN) and tracks it as a `torrent`-provider item. The
 * background poller advances its status and, on completion, writes
 * {@link debridLinks} pointing at the files on disk.
 *
 * Idempotent: a media item already tracked (by either provider) returns its
 * current state instead of re-adding — the unique `debrid_items.media_item_id`
 * constraint means one item maps to one delivery method.
 */
export async function addSearchResultToTorrent(
  input: AddToDebridRequest,
): Promise<AddToDebridResponse> {
  const infoHash = resolveInfoHash(input);
  const magnet = input.magnetUrl ?? buildMagnetUri(infoHash, input.title);

  if (!magnet || !infoHash) {
    throw new AddTorrentError(
      "The torrent download path needs a magnet link or info hash.",
      400,
    );
  }

  // Prefer the indexer's .torrent file (qBittorrent fetches it and gets the
  // real trackers + web seeds). A bare info-hash magnet is trackerless and
  // would rely on DHT alone — unreliable behind a no-port-forward VPN — so the
  // fallback magnet gets default public trackers appended.
  const source =
    input.sourceUrl && isTorrentFileUrl(input.sourceUrl)
      ? input.sourceUrl
      : withDefaultTrackers(magnet);

  const client = new QBittorrentClient();
  if (!client.isConfigured()) {
    throw new AddTorrentError(
      "qBittorrent isn't configured. Set QBITTORRENT_USERNAME and QBITTORRENT_PASSWORD.",
      503,
    );
  }

  const mediaItem = await upsertMediaItem(input, infoHash);
  const existing = await findDebridItem(mediaItem.id);

  if (existing && existing.status !== "error" && existing.status !== "deleted") {
    return toResponse(mediaItem.id, existing, true);
  }

  await upsertDebridItem(mediaItem.id, {
    provider: "torrent",
    status: "adding",
    progress: 0,
    errorMessage: null,
    addedToDebridAt: new Date(),
  });

  try {
    await client.addSource(source, {
      savePath: path.join(env.TORRENT_DOWNLOAD_DIR, infoHash),
      category: TORRENT_CATEGORY,
    });
  } catch (error) {
    const message =
      error instanceof QBittorrentError
        ? error.message
        : "Failed to hand the magnet to qBittorrent.";
    await upsertDebridItem(mediaItem.id, { status: "error", errorMessage: message });
    throw new AddTorrentError(message, 502);
  }

  const queued = await upsertDebridItem(mediaItem.id, {
    status: "downloading",
    progress: 0,
  });
  await enqueueDebridPolling(queued.id);

  return toResponse(mediaItem.id, queued, false);
}

type DebridItemRow = typeof debridItems.$inferSelect;
type DebridItemPatch = Partial<typeof debridItems.$inferInsert>;

async function findDebridItem(mediaItemId: string): Promise<DebridItemRow | undefined> {
  const [row] = await db
    .select()
    .from(debridItems)
    .where(eq(debridItems.mediaItemId, mediaItemId))
    .limit(1);

  return row;
}

/** Inserts or updates the single debrid_item for a media item. */
async function upsertDebridItem(
  mediaItemId: string,
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
    .values({ mediaItemId, ...patch })
    .returning();

  return created;
}

async function toResponse(
  mediaItemId: string,
  row: DebridItemRow,
  reused: boolean,
): Promise<AddToDebridResponse> {
  return {
    mediaItemId,
    debridItemId: row.id,
    torrentId: null,
    status: row.status as DebridItemStatus,
    availability: toAvailability(row.status),
    progress: row.progress,
    primaryReadableLinkId: await findPrimaryReadableLinkId(row.id),
    reused,
  };
}

async function findPrimaryReadableLinkId(
  debridItemId: string,
): Promise<string | undefined> {
  const links = await db
    .select({
      id: debridLinks.id,
      fileName: debridLinks.fileName,
      fileSizeBytes: debridLinks.fileSizeBytes,
    })
    .from(debridLinks)
    .where(eq(debridLinks.debridItemId, debridItemId));

  return links
    .filter((link) => isReadableMangaFile(link.fileName))
    .sort((a, b) => (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0))[0]?.id;
}

/** Synthesizes a magnet URI for results that only carry an info hash. */
function buildMagnetUri(infoHash: string | null, title: string): string | null {
  if (!infoHash) {
    return null;
  }

  const params = new URLSearchParams({ dn: title });
  return `magnet:?xt=urn:btih:${infoHash}&${params.toString()}`;
}

/**
 * Reliable public trackers appended to magnets that ship without their own, so
 * peer discovery doesn't depend solely on DHT (which struggles behind a VPN
 * with no inbound port forwarding).
 */
const DEFAULT_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.tracker.cl:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "http://nyaa.tracker.wf:7777/announce",
];

/** Appends the default public trackers to a magnet (no-op for .torrent URLs). */
function withDefaultTrackers(magnet: string): string {
  if (!magnet.startsWith("magnet:")) {
    return magnet;
  }
  const extra = DEFAULT_TRACKERS.map(
    (tracker) => `&tr=${encodeURIComponent(tracker)}`,
  ).join("");
  return `${magnet}${extra}`;
}
