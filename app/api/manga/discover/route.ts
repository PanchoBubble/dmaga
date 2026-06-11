import { NextRequest, NextResponse } from "next/server";

import {
  DISCOVER_PROVIDERS,
  getDiscoverByGenre,
  getDiscoverFeed,
} from "@/lib/server/manga-providers";
import type {
  DiscoverFeed,
  MangaProviderKey,
} from "@/lib/server/manga-providers/types";

export const dynamic = "force-dynamic";

/**
 * Provider-native discover feed. `?feed=latest|popular` (default popular),
 * optional `&genre={id}` to browse a genre, `&provider={key}` to scope to one
 * provider, `&page={n}` for pagination. Returns a flat ProviderSeries list.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const feed: DiscoverFeed = params.get("feed") === "latest" ? "latest" : "popular";
  const genre = params.get("genre")?.trim() || null;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const providerParam = params.get("provider")?.trim();
  const provider =
    providerParam && DISCOVER_PROVIDERS.includes(providerParam as MangaProviderKey)
      ? (providerParam as MangaProviderKey)
      : undefined;

  try {
    const series = genre
      ? await getDiscoverByGenre(provider ?? DISCOVER_PROVIDERS[0], genre, page)
      : await getDiscoverFeed(feed, page, provider);
    return NextResponse.json({ series, page });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load discover feed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
