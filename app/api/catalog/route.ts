import { NextRequest, NextResponse } from "next/server";

import {
  asCatalogType,
  catalogGenres,
  catalogSorts,
  type CatalogSort,
} from "@/lib/metadata";
import { fetchCatalog } from "@/lib/server/metadata/cinemeta";

/**
 * Browse-grid backend for the Discover pages. Proxies Cinemeta so the client
 * never talks to it directly (keeps the upstream host + caching server-side).
 * `GET /api/catalog?type=movie&sort=top&genre=Action&skip=100&search=batman`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const type = asCatalogType(params.get("type") ?? undefined);
  if (!type) {
    return NextResponse.json(
      { error: "type must be 'movie' or 'series'." },
      { status: 400 },
    );
  }

  const sortParam = params.get("sort");
  const sort: CatalogSort | undefined = catalogSorts.some((s) => s.id === sortParam)
    ? (sortParam as CatalogSort)
    : undefined;

  const genreParam = params.get("genre");
  const genre = catalogGenres.includes(genreParam as (typeof catalogGenres)[number])
    ? (genreParam as string)
    : undefined;

  const search = params.get("search")?.trim() || undefined;

  const skipRaw = Number(params.get("skip"));
  const skip =
    Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : undefined;

  const items = await fetchCatalog({ type, sort, genre, search, skip });
  return NextResponse.json({ items });
}
