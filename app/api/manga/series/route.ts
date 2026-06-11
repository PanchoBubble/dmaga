import { NextRequest, NextResponse } from "next/server";

import { getSeriesNative, DISCOVER_PROVIDERS } from "@/lib/server/manga-providers";
import type { MangaProviderKey } from "@/lib/server/manga-providers/types";

export const dynamic = "force-dynamic";

/**
 * Provider-native series detail (header + chapters). Backs the client-rendered
 * series page so the slow (~20s) byparr Cloudflare solve happens behind a
 * spinner instead of blocking navigation.
 */
export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider")?.trim();
  const seriesId = request.nextUrl.searchParams.get("seriesId")?.trim();

  if (
    !provider ||
    !seriesId ||
    !DISCOVER_PROVIDERS.includes(provider as MangaProviderKey)
  ) {
    return NextResponse.json({ error: "Unknown series." }, { status: 400 });
  }

  try {
    const series = await getSeriesNative(provider as MangaProviderKey, seriesId);
    return NextResponse.json({ series });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load this series.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
