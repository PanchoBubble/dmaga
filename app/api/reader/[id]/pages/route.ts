import { NextRequest, NextResponse } from "next/server";

import { listMangaArchivePages } from "@/lib/server/manga-archives";
import {
  fetchMangaArchiveBuffer,
  getReadableMangaLink,
} from "@/lib/server/manga-reader";
import { PlaybackError } from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };
type ArchivePagesEvent =
  | { type: "status"; message: string }
  | { type: "download"; receivedBytes: number; totalBytes?: number }
  | { type: "done"; pages: Awaited<ReturnType<typeof listMangaArchivePages>> }
  | { type: "error"; message: string; status: number };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  if (request.nextUrl.searchParams.get("stream") === "1") {
    return streamArchivePages(id);
  }

  try {
    const link = await getReadableMangaLink(id);
    if (link.kind !== "archive") {
      return NextResponse.json({ pages: [] });
    }

    const buffer = await fetchMangaArchiveBuffer(id);
    return NextResponse.json({
      pages: await listMangaArchivePages(buffer, link.fileName),
    });
  } catch (error) {
    if (error instanceof PlaybackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to read manga archive.",
      },
      { status: 500 },
    );
  }
}

function streamArchivePages(id: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: ArchivePagesEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        send({ type: "status", message: "Resolving archive link" });
        const link = await getReadableMangaLink(id);
        if (link.kind !== "archive") {
          send({ type: "done", pages: [] });
          return;
        }

        send({ type: "status", message: "Downloading archive" });
        const buffer = await fetchMangaArchiveBuffer(id, {
          onDownloadProgress: (progress) => {
            send({ type: "download", ...progress });
          },
        });

        send({ type: "status", message: "Scanning archive pages" });
        const pages = await listMangaArchivePages(buffer, link.fileName);
        send({ type: "done", pages });
      } catch (error) {
        const status = error instanceof PlaybackError ? error.status : 500;
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to read manga archive.",
          status,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
