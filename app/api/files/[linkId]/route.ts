import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridLinks } from "@/lib/db/schema";
import { classifyPlayback } from "@/lib/playback";
import { env } from "@/lib/server/env";

type RouteContext = { params: Promise<{ linkId: string }> };

// Streams bytes off disk on demand, so it must never be cached/buffered.
export const dynamic = "force-dynamic";

/**
 * Serves a torrent-provider file straight from disk, with HTTP Range support so
 * the browser `<video>` element (and VLC) can seek and the download route can
 * resume. The link's `localPath` must resolve inside the configured downloads
 * dir — anything else is rejected so a crafted row can't read arbitrary files.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { linkId } = await params;

  const [link] = await db
    .select({ fileName: debridLinks.fileName, localPath: debridLinks.localPath })
    .from(debridLinks)
    .where(eq(debridLinks.id, linkId))
    .limit(1);

  if (!link?.localPath) {
    return Response.json({ error: "No local file for this link." }, { status: 404 });
  }

  const root = path.resolve(env.TORRENT_DOWNLOAD_DIR);
  const filePath = path.resolve(link.localPath);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return Response.json({ error: "File path is out of bounds." }, { status: 403 });
  }

  let fileSize: number;
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return Response.json({ error: "Not a file." }, { status: 404 });
    }
    fileSize = stats.size;
  } catch {
    return Response.json({ error: "File not found on disk." }, { status: 404 });
  }

  const contentType =
    classifyPlayback(link.fileName).mimeType ?? "application/octet-stream";
  const range = parseRange(request.headers.get("range"), fileSize);

  if (range) {
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}

/** Parses a single `bytes=start-end` range, clamped to the file size. */
function parseRange(
  header: string | null,
  fileSize: number,
): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (rawStart === "" && rawEnd !== "") {
    // Suffix range: last N bytes.
    start = Math.max(0, fileSize - Number(rawEnd));
    end = fileSize - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) {
    return null;
  }

  return { start, end: Math.min(end, fileSize - 1) };
}
