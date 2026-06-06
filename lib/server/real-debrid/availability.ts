import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, mediaItems } from "@/lib/db/schema";
import type { DebridAvailability } from "@/lib/search";

type DebridItemStatus = (typeof debridItems.status.enumValues)[number];

/** Collapses the granular debrid_item status into the coarse UI availability. */
export function toAvailability(status: DebridItemStatus): DebridAvailability {
  switch (status) {
    case "ready":
      return "ready";
    case "adding":
    case "waiting_files_selection":
    case "queued":
    case "downloading":
      return "downloading";
    case "saved":
      return "saved";
    default:
      // error / deleted — treat as not present so the user can re-add.
      return "unknown";
  }
}

/**
 * Builds a lookup of `infoHash -> availability` for the given hashes by joining
 * locally-tracked media items to their debrid item. Lets a fresh search surface
 * which torrents we already have in Real-Debrid. Returns an empty map when no
 * hashes are supplied so callers can skip the query for hash-less results.
 */
export async function getDebridAvailabilityByInfoHash(
  infoHashes: string[],
): Promise<Map<string, DebridAvailability>> {
  const unique = [...new Set(infoHashes.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      infoHash: mediaItems.infoHash,
      status: debridItems.status,
    })
    .from(debridItems)
    .innerJoin(mediaItems, eq(debridItems.mediaItemId, mediaItems.id))
    .where(inArray(mediaItems.infoHash, unique));

  const map = new Map<string, DebridAvailability>();
  for (const row of rows) {
    if (!row.infoHash) {
      continue;
    }
    const availability = toAvailability(row.status);
    if (availability !== "unknown") {
      map.set(row.infoHash, availability);
    }
  }

  return map;
}
