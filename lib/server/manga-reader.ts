import "server-only";

import { classifyMangaFile } from "@/lib/manga";
import { resolveDownloadStream } from "@/lib/server/real-debrid/playback";

export async function getReadableMangaLink(linkId: string, refresh = false) {
  const stream = await resolveDownloadStream(linkId, { refresh });
  const info = classifyMangaFile(stream.fileName);

  return {
    ...stream,
    ...info,
    readable: info.kind !== "unsupported",
  };
}

export async function fetchMangaArchiveBuffer(linkId: string): Promise<Buffer> {
  const link = await getReadableMangaLink(linkId, true);
  if (link.kind !== "archive") {
    throw new Error("This file is not a CBZ/ZIP archive.");
  }

  const response = await fetch(link.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to fetch manga archive.");
  }

  return Buffer.from(await response.arrayBuffer());
}
