import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, mediaItems } from "@/lib/db/schema";
import type { SetSavedRequest, SetSavedResponse } from "@/lib/saved";
import type { SearchResultDto } from "@/lib/search";
import { resolveInfoHash, upsertMediaItem } from "@/lib/server/media-items";
import { toAvailability } from "@/lib/server/real-debrid/availability";

/**
 * Stars or unstars a search result. Upserts the backing media item (so a result
 * the user has never added before becomes trackable) and flips its `saved`
 * flag. Idempotent: re-saving an already-saved item is a no-op write.
 */
export async function setSavedState(
  input: SetSavedRequest,
): Promise<SetSavedResponse> {
  const infoHash = resolveInfoHash(input);
  const mediaItem = await upsertMediaItem(input, infoHash);

  const [updated] = await db
    .update(mediaItems)
    .set({ saved: input.saved, updatedAt: new Date() })
    .where(eq(mediaItems.id, mediaItem.id))
    .returning({ id: mediaItems.id, saved: mediaItems.saved });

  return { mediaItemId: updated.id, saved: updated.saved };
}

/**
 * Lists starred torrents for the Saved page as search-result DTOs (newest
 * first), stamping each with its current Real-Debrid availability so the same
 * card can offer Add/Download. Each media item has at most one debrid item
 * (unique index), so the left join never fans out.
 */
export async function listSavedItems(): Promise<SearchResultDto[]> {
  const rows = await db
    .select({
      id: mediaItems.id,
      title: mediaItems.title,
      sizeBytes: mediaItems.sizeBytes,
      seeders: mediaItems.seeders,
      leechers: mediaItems.leechers,
      publishedAt: mediaItems.publishedAt,
      indexerId: mediaItems.indexerId,
      indexerName: mediaItems.indexerName,
      magnetUrl: mediaItems.magnetUrl,
      infoHash: mediaItems.infoHash,
      sourceUrl: mediaItems.sourceUrl,
      status: debridItems.status,
    })
    .from(mediaItems)
    .leftJoin(debridItems, eq(debridItems.mediaItemId, mediaItems.id))
    .where(eq(mediaItems.saved, true))
    .orderBy(desc(mediaItems.updatedAt));

  return rows.map((row) => ({
    id: row.infoHash ?? row.id,
    title: row.title,
    sizeBytes: row.sizeBytes ?? undefined,
    seeders: row.seeders ?? undefined,
    leechers: row.leechers ?? undefined,
    publishedAt: row.publishedAt?.toISOString(),
    indexerId: row.indexerId ?? "",
    indexerName: row.indexerName,
    magnetUrl: row.magnetUrl ?? undefined,
    infoHash: row.infoHash ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    debridState: row.status ? toAvailability(row.status) : "unknown",
    saved: true,
  }));
}

/**
 * Returns the subset of the given info hashes that are currently saved, so a
 * fresh search can render the star pre-filled. Empty input skips the query.
 */
export async function getSavedInfoHashes(
  infoHashes: string[],
): Promise<Set<string>> {
  const unique = [...new Set(infoHashes.filter(Boolean))];
  if (unique.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({ infoHash: mediaItems.infoHash })
    .from(mediaItems)
    .where(and(eq(mediaItems.saved, true), inArray(mediaItems.infoHash, unique)));

  return new Set(rows.map((row) => row.infoHash).filter((h): h is string => !!h));
}

/** Counts saved torrents for the Saved nav badge. */
export async function countSavedItems(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(mediaItems)
    .where(eq(mediaItems.saved, true));

  return row?.value ?? 0;
}
