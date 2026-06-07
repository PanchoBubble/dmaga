import { NextResponse } from "next/server";

import { listMangaArchivePages } from "@/lib/server/manga-archives";
import {
  fetchMangaArchiveBuffer,
  getReadableMangaLink,
} from "@/lib/server/manga-reader";
import { PlaybackError } from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const link = await getReadableMangaLink(id);
    if (link.kind !== "archive") {
      return NextResponse.json({ pages: [] });
    }

    const buffer = await fetchMangaArchiveBuffer(id);
    return NextResponse.json({ pages: listMangaArchivePages(buffer) });
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
