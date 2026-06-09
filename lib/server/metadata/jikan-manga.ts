import "server-only";

import type { MangaCatalogItem } from "@/lib/manga";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const REVALIDATE_SECONDS = 60 * 60;

type JikanMangaResponse = {
  data?: RawJikanManga[];
};

type RawJikanManga = {
  mal_id?: number;
  title?: string;
  title_english?: string | null;
  synopsis?: string | null;
  score?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  type?: string | null;
  status?: string | null;
  images?: {
    jpg?: {
      image_url?: string | null;
      large_image_url?: string | null;
    };
    webp?: {
      image_url?: string | null;
      large_image_url?: string | null;
    };
  };
  published?: {
    string?: string | null;
  };
};

export async function searchMangaCatalog(
  query: string,
  limit = 18,
): Promise<MangaCatalogItem[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
    sfw: "true",
    order_by: "members",
    sort: "desc",
  });

  return fetchMangaList(`/manga?${params}`);
}

export async function fetchPopularMangaCatalog(
  limit = 12,
): Promise<MangaCatalogItem[]> {
  return fetchTopManga("bypopularity", limit);
}

/**
 * Fetches a row from Jikan's /top/manga endpoint. `filter` is one of Jikan's
 * supported values (`bypopularity`, `publishing`, `favorite`) or omitted for
 * top-by-score. Used to build the manga browse rows.
 */
export async function fetchTopManga(
  filter: "bypopularity" | "publishing" | "favorite" | null,
  limit = 12,
): Promise<MangaCatalogItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filter) {
    params.set("filter", filter);
  }

  return fetchMangaList(`/top/manga?${params}`);
}

export async function fetchMangaCatalogItem(
  id: number,
): Promise<MangaCatalogItem | null> {
  try {
    const response = await fetch(`${JIKAN_BASE}/manga/${id}/full`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { data?: RawJikanManga };
    return payload.data ? toMangaCatalogItem(payload.data) : null;
  } catch {
    return null;
  }
}

async function fetchMangaList(path: string): Promise<MangaCatalogItem[]> {
  try {
    const response = await fetch(`${JIKAN_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as JikanMangaResponse;
    return (payload.data ?? [])
      .map(toMangaCatalogItem)
      .filter((item): item is MangaCatalogItem => item !== null);
  } catch {
    return [];
  }
}

function toMangaCatalogItem(manga: RawJikanManga): MangaCatalogItem | null {
  if (!manga.mal_id || !manga.title) {
    return null;
  }

  const poster =
    manga.images?.webp?.large_image_url ??
    manga.images?.jpg?.large_image_url ??
    manga.images?.webp?.image_url ??
    manga.images?.jpg?.image_url ??
    undefined;
  const year = manga.published?.string?.match(/\d{4}/)?.[0];
  const bits = [manga.type, year, manga.status].filter(Boolean);

  return {
    id: manga.mal_id,
    slug: `mal-${manga.mal_id}-${slugify(manga.title)}`,
    title: manga.title,
    subtitle: bits.length ? bits.join(" · ") : "Manga",
    // Bare title — manga searches are already scoped to manga categories on
    // Nyaa/Tokyo Toshokan, and appending "manga" wrongly excludes release
    // titles (e.g. "Berserk v01-40") that don't contain the word.
    query: manga.title,
    poster,
    synopsis: manga.synopsis ?? undefined,
    score: manga.score ?? undefined,
    chapters: manga.chapters ?? undefined,
    volumes: manga.volumes ?? undefined,
    url: `https://myanimelist.net/manga/${manga.mal_id}`,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
