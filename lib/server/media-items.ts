import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { mediaItems } from "@/lib/db/schema";

/** Common media fields shared by the add-to-Debrid and save (favorite) flows. */
export type MediaItemInput = {
  title: string;
  infoHash?: string;
  magnetUrl?: string;
  sizeBytes?: number;
  seeders?: number;
  leechers?: number;
  /** ISO 8601 publish timestamp from the indexer, when known. */
  publishedAt?: string;
  indexerId?: string;
  indexerName: string;
  sourceUrl?: string;
};

type MediaItemRow = typeof mediaItems.$inferSelect;

const INFO_HASH_PATTERN = /xt=urn:btih:([0-9a-z]+)/i;

/** Pulls the btih info hash out of a magnet URI, when present. */
export function parseInfoHashFromMagnet(magnet: string | undefined): string | undefined {
  return magnet?.match(INFO_HASH_PATTERN)?.[1];
}

export function normalizeInfoHash(infoHash: string | undefined): string | null {
  return infoHash ? infoHash.trim().toLowerCase() : null;
}

/** Resolves the canonical (lowercased) info hash from an explicit hash or magnet. */
export function resolveInfoHash(input: {
  infoHash?: string;
  magnetUrl?: string;
}): string | null {
  return normalizeInfoHash(input.infoHash ?? parseInfoHashFromMagnet(input.magnetUrl));
}

/**
 * Finds the media item for an info hash, or inserts a new row from the given
 * fields. Shared by the add-to-Debrid and save flows so a torrent maps to a
 * single `media_items` row regardless of which action touched it first.
 */
export async function upsertMediaItem(
  input: MediaItemInput,
  infoHash: string | null,
): Promise<MediaItemRow> {
  if (infoHash) {
    const [existing] = await db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.infoHash, infoHash))
      .limit(1);

    if (existing) {
      return existing;
    }
  }

  const [created] = await db
    .insert(mediaItems)
    .values({
      title: input.title,
      normalizedTitle: input.title.trim().toLowerCase(),
      sizeBytes: input.sizeBytes ?? null,
      seeders: input.seeders ?? null,
      leechers: input.leechers ?? null,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      indexerId: input.indexerId ?? null,
      indexerName: input.indexerName,
      magnetUrl: input.magnetUrl ?? null,
      infoHash,
      sourceUrl: input.sourceUrl ?? null,
    })
    .returning();

  return created;
}
