import { NextRequest, NextResponse } from "next/server";

import { readMangaArchivePage } from "@/lib/server/manga-archives";
import {
  fetchMangaArchiveBuffer,
  getReadableMangaLink,
} from "@/lib/server/manga-reader";
import { PlaybackError } from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const name = request.nextUrl.searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Page name is required." }, { status: 400 });
  }

  try {
    const link = await getReadableMangaLink(id);
    const buffer = await fetchMangaArchiveBuffer(id);
    const page = await readMangaArchivePage(buffer, link.fileName, name);
    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    return new Response(new Uint8Array(page.bytes), {
      headers: {
        "Content-Type": page.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof PlaybackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to read manga page.",
      },
      { status: 500 },
    );
  }
}
