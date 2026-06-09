import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridItems, debridLinks } from "@/lib/db/schema";
import type { AddToDebridRequest, AddToDebridResponse } from "@/lib/debrid";
import { isReadableMangaFile } from "@/lib/manga";
import { classifyPlayback } from "@/lib/playback";
import { toAvailability } from "@/lib/server/real-debrid/availability";
import { upsertMediaItem } from "@/lib/server/media-items";

export class AddDirectError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "AddDirectError";
  }
}

/**
 * Adds a direct-HTTP source (no torrent, no Real-Debrid). Resolves the item's
 * files at add time and records a `direct`-provider item whose links point
 * straight at the source URLs — so the player/reader/download routes stream
 * them via the `direct` branch in {@link resolveLinkStream}. Marked `ready`
 * immediately; there's nothing to download first.
 *
 * Idempotent per media item (one delivery method per item), like the other
 * add flows.
 */
export async function addDirectSource(
  input: AddToDebridRequest,
): Promise<AddToDebridResponse> {
  if (input.directSource?.kind !== "internet_archive") {
    throw new AddDirectError("This result has no supported direct source.", 400);
  }

  const files = await resolveArchiveFiles(input.directSource.identifier);
  if (files.length === 0) {
    throw new AddDirectError(
      "No streamable or readable files were found in this Archive.org item.",
      404,
    );
  }

  const mediaItem = await upsertMediaItem(input, null);
  const existing = await findDebridItem(mediaItem.id);

  if (existing && existing.status !== "error" && existing.status !== "deleted") {
    return toResponse(mediaItem.id, existing, true);
  }

  const now = new Date();
  const item = await upsertDebridItem(mediaItem.id, {
    provider: "direct",
    status: "ready",
    progress: 100,
    errorMessage: null,
    addedToDebridAt: now,
    completedAt: now,
  });

  await db.delete(debridLinks).where(eq(debridLinks.debridItemId, item.id));
  await db.insert(debridLinks).values(
    files.map((file) => ({
      debridItemId: item.id,
      fileName: file.fileName,
      fileSizeBytes: file.sizeBytes,
      host: "archive.org",
      originalLink: file.url,
      unrestrictedLink: file.url,
      localPath: null,
      mimeType: file.mimeType,
      streamable: file.streamable,
    })),
  );

  return toResponse(mediaItem.id, item, false);
}

type ResolvedFile = {
  fileName: string;
  url: string;
  sizeBytes: number | null;
  mimeType: string | null;
  streamable: boolean;
};

type ArchiveMetadata = {
  files?: { name?: string; size?: string; format?: string }[];
};

/**
 * Fetches an Archive.org item's metadata and keeps only the files we can play
 * or read, building a direct `/download/<id>/<file>` URL for each.
 */
async function resolveArchiveFiles(identifier: string): Promise<ResolvedFile[]> {
  let metadata: ArchiveMetadata;
  try {
    const response = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) {
      throw new AddDirectError(
        `Archive.org metadata request failed (${response.status}).`,
      );
    }
    metadata = (await response.json()) as ArchiveMetadata;
  } catch (error) {
    if (error instanceof AddDirectError) {
      throw error;
    }
    throw new AddDirectError("Unable to reach Archive.org.");
  }

  const resolved: ResolvedFile[] = [];
  for (const file of metadata.files ?? []) {
    const name = file.name?.trim();
    if (!name) {
      continue;
    }

    const playback = classifyPlayback(name);
    const playable = playback.kind === "video" || playback.kind === "audio";
    if (!playable && !isReadableMangaFile(name)) {
      continue;
    }

    const url = `https://archive.org/download/${encodeURIComponent(identifier)}/${name
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const size = Number(file.size);

    resolved.push({
      fileName: name.split("/").pop() ?? name,
      url,
      sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
      mimeType: playback.mimeType,
      streamable: playable,
    });
  }

  return resolved;
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
    status: row.status,
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
