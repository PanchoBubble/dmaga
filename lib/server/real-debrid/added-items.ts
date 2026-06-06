import { and, count, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks, hostDownloads, mediaItems } from "@/lib/db/schema";
import type { AddedItemDto } from "@/lib/debrid";
import { createAuthenticatedRealDebridClient } from "@/lib/server/real-debrid/auth-service";
import { toAvailability } from "@/lib/server/real-debrid/availability";

/**
 * Lists locally-tracked Real-Debrid items for the Added page, newest activity
 * first. Removed (`deleted`) items are kept visible so the UI can show the
 * terminal "Removed" state instead of silently losing recent history.
 */
export async function listAddedItems(): Promise<AddedItemDto[]> {
  const rows = await db
    .select({
      id: debridItems.id,
      mediaItemId: debridItems.mediaItemId,
      title: mediaItems.title,
      indexerName: mediaItems.indexerName,
      sizeBytes: mediaItems.sizeBytes,
      infoHash: mediaItems.infoHash,
      status: debridItems.status,
      progress: debridItems.progress,
      torrentId: debridItems.realDebridTorrentId,
      errorMessage: debridItems.errorMessage,
      addedAt: debridItems.addedToDebridAt,
      updatedAt: debridItems.updatedAt,
    })
    .from(debridItems)
    .innerJoin(mediaItems, eq(debridItems.mediaItemId, mediaItems.id))
    .orderBy(desc(debridItems.updatedAt));

  const itemIds = rows.map((row) => row.id);
  const linkRows = itemIds.length
    ? await db
        .select({
          id: debridLinks.id,
          debridItemId: debridLinks.debridItemId,
          fileName: debridLinks.fileName,
          fileSizeBytes: debridLinks.fileSizeBytes,
          host: debridLinks.host,
          originalLink: debridLinks.originalLink,
          unrestrictedLink: debridLinks.unrestrictedLink,
          streamable: debridLinks.streamable,
        })
        .from(debridLinks)
        .where(inArray(debridLinks.debridItemId, itemIds))
    : [];
  const linksByItem = new Map<string, typeof linkRows>();
  for (const link of linkRows) {
    linksByItem.set(link.debridItemId, [
      ...(linksByItem.get(link.debridItemId) ?? []),
      link,
    ]);
  }
  const linkIds = linkRows.map((link) => link.id);
  const hostDownloadRows = linkIds.length
    ? await db
        .select({
          id: hostDownloads.id,
          debridLinkId: hostDownloads.debridLinkId,
          status: hostDownloads.status,
          targetPath: hostDownloads.targetPath,
          bytesDownloaded: hostDownloads.bytesDownloaded,
          errorMessage: hostDownloads.errorMessage,
          updatedAt: hostDownloads.updatedAt,
        })
        .from(hostDownloads)
        .where(inArray(hostDownloads.debridLinkId, linkIds))
        .orderBy(desc(hostDownloads.updatedAt))
    : [];
  const latestHostDownloadByLink = new Map<string, (typeof hostDownloadRows)[number]>();
  for (const download of hostDownloadRows) {
    if (!latestHostDownloadByLink.has(download.debridLinkId)) {
      latestHostDownloadByLink.set(download.debridLinkId, download);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    mediaItemId: row.mediaItemId,
    title: row.title,
    indexerName: row.indexerName,
    sizeBytes: row.sizeBytes,
    status: row.status,
    availability: toAvailability(row.status),
    progress: row.progress,
    torrentId: row.torrentId,
    infoHash: row.infoHash,
    errorMessage: row.errorMessage,
    links: (linksByItem.get(row.id) ?? []).map((link) => ({
      id: link.id,
      fileName: link.fileName,
      fileSizeBytes: link.fileSizeBytes,
      host: link.host,
      originalLink: link.originalLink,
      unrestrictedLink: link.unrestrictedLink,
      streamable: link.streamable,
      hostDownload: latestHostDownloadByLink.has(link.id)
        ? {
            id: latestHostDownloadByLink.get(link.id)!.id,
            status: latestHostDownloadByLink.get(link.id)!.status,
            targetPath: latestHostDownloadByLink.get(link.id)!.targetPath,
            bytesDownloaded: latestHostDownloadByLink.get(link.id)!.bytesDownloaded,
            errorMessage: latestHostDownloadByLink.get(link.id)!.errorMessage,
          }
        : null,
    })),
    addedAt: row.addedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export type AddedItemAction = "remove_local" | "delete_from_debrid";

export class AddedItemActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AddedItemActionError";
  }
}

/**
 * Marks an Added item as removed locally, optionally deleting/cancelling the
 * corresponding Real-Debrid torrent first when one is known.
 */
export async function updateAddedItemAction(
  id: string,
  action: AddedItemAction,
): Promise<AddedItemDto> {
  const [item] = await db.select().from(debridItems).where(eq(debridItems.id, id));

  if (!item) {
    throw new AddedItemActionError("Added item not found.", 404);
  }

  if (action === "delete_from_debrid" && item.realDebridTorrentId) {
    const client = await createAuthenticatedRealDebridClient();
    await client.deleteTorrent(item.realDebridTorrentId);
  }

  await db
    .update(debridItems)
    .set({
      status: "deleted",
      progress: 0,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(debridItems.id, id))
    .returning();

  const refreshed = (await listAddedItems()).find((candidate) => candidate.id === id);
  if (!refreshed) {
    throw new AddedItemActionError("Added item not found after update.", 500);
  }
  return refreshed;
}

/**
 * Counts tracked items for the nav badge: everything that isn't removed or
 * errored, i.e. the items the user is actively working with.
 */
export async function countActiveAddedItems(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(debridItems)
    .where(and(ne(debridItems.status, "deleted"), ne(debridItems.status, "error")));

  return row?.value ?? 0;
}
