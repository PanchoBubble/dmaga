import "server-only";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

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

export type MangaArchiveDownloadProgress = {
  receivedBytes: number;
  totalBytes?: number;
};

export async function fetchMangaArchiveBuffer(
  linkId: string,
  options: {
    onDownloadProgress?: (progress: MangaArchiveDownloadProgress) => void;
  } = {},
): Promise<Buffer> {
  const link = await getReadableMangaLink(linkId, true);
  if (link.kind !== "archive") {
    throw new Error("This file is not a readable archive.");
  }

  // Torrent-provider archives live on disk — read them directly instead of
  // round-tripping the file back through our own /api/files route.
  if (link.localPath) {
    return readArchiveFromDisk(link.localPath, options.onDownloadProgress);
  }

  const response = await fetch(link.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to fetch manga archive.");
  }

  const totalBytes = parseContentLength(response.headers.get("content-length"));
  if (response.body && options.onDownloadProgress) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      receivedBytes += value.byteLength;
      options.onDownloadProgress({ receivedBytes, totalBytes });
    }

    return Buffer.concat(chunks);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function readArchiveFromDisk(
  filePath: string,
  onDownloadProgress?: (progress: MangaArchiveDownloadProgress) => void,
): Promise<Buffer> {
  const totalBytes = (await stat(filePath)).size;
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of createReadStream(filePath)) {
    const buffer = chunk as Buffer;
    chunks.push(buffer);
    receivedBytes += buffer.byteLength;
    onDownloadProgress?.({ receivedBytes, totalBytes });
  }

  return Buffer.concat(chunks);
}

function parseContentLength(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
