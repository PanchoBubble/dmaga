import "server-only";

import type {
  CatalogItem,
  CatalogSort,
  CatalogType,
  EpisodeInfo,
  TitleDetail,
} from "@/lib/metadata";

/**
 * Server-side client for Stremio's Cinemeta catalog — the same free metadata
 * source the Torrentio adapter already uses for id resolution. Powers the
 * Discover browse grids (`fetchCatalog`) and the title detail page
 * (`fetchTitle`). Responses are public and slow-changing, so we lean on Next's
 * fetch cache with a generous revalidate window rather than hitting Cinemeta on
 * every request. The catalog endpoint 307-redirects to a sibling host; the
 * platform `fetch` follows redirects by default.
 */
const CINEMETA_BASE = "https://v3-cinemeta.strem.io";

/** Catalog metas change slowly; cache for an hour. */
const CATALOG_REVALIDATE_SECONDS = 60 * 60;
/** Title metadata (incl. episode lists) is near-static; cache for a day. */
const META_REVALIDATE_SECONDS = 60 * 60 * 24;

type CinemetaCatalogResponse = {
  metas?: RawMeta[];
};

type CinemetaMetaResponse = {
  meta?: RawMeta;
};

type RawMeta = {
  id?: string;
  type?: string;
  name?: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  runtime?: string;
  genres?: string[];
  cast?: string[];
  videos?: RawVideo[];
};

type RawVideo = {
  id?: string;
  season?: number;
  episode?: number;
  number?: number;
  name?: string;
  title?: string;
  overview?: string;
  description?: string;
  thumbnail?: string;
  released?: string;
  firstAired?: string;
};

export type CatalogQuery = {
  type: CatalogType;
  /** Cinemeta catalog id; defaults to `top` (Popular). */
  sort?: CatalogSort;
  /** Optional genre filter (must be one of `catalogGenres`). */
  genre?: string;
  /** Free-text search; when present, overrides genre. */
  search?: string;
  /** Pagination offset; Cinemeta pages in increments of ~50-100. */
  skip?: number;
};

/** Fetches one page of catalog tiles. Returns `[]` on any upstream failure. */
export async function fetchCatalog(query: CatalogQuery): Promise<CatalogItem[]> {
  const url = catalogUrl(query);
  try {
    const response = await fetch(url, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as CinemetaCatalogResponse;
    return (payload.metas ?? [])
      .map((meta) => toCatalogItem(meta, query.type))
      .filter((item): item is CatalogItem => item !== null);
  } catch {
    return [];
  }
}

/** Fetches full detail (with episodes for series). Returns null when missing. */
export async function fetchTitle(
  type: CatalogType,
  id: string,
): Promise<TitleDetail | null> {
  const url = `${CINEMETA_BASE}/meta/${type}/${encodeURIComponent(id)}.json`;
  try {
    const response = await fetch(url, {
      next: { revalidate: META_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as CinemetaMetaResponse;
    return payload.meta ? toTitleDetail(payload.meta, type) : null;
  } catch {
    return null;
  }
}

function catalogUrl(query: CatalogQuery): string {
  const sort: CatalogSort = query.sort ?? "top";
  // Cinemeta encodes "extra" params as a `key=value` segment in the path,
  // not the query string, e.g. `/catalog/movie/top/genre=Action&skip=100.json`.
  const extras: string[] = [];
  if (query.search?.trim()) {
    extras.push(`search=${encodeURIComponent(query.search.trim())}`);
  } else if (query.genre) {
    extras.push(`genre=${encodeURIComponent(query.genre)}`);
  }
  if (query.skip && query.skip > 0) {
    extras.push(`skip=${query.skip}`);
  }
  const suffix = extras.length ? `/${extras.join("&")}` : "";
  return `${CINEMETA_BASE}/catalog/${query.type}/${sort}${suffix}.json`;
}

function toCatalogItem(meta: RawMeta, fallbackType: CatalogType): CatalogItem | null {
  if (!meta.id || !meta.name) {
    return null;
  }
  return {
    id: meta.id,
    type:
      meta.type === "series"
        ? "series"
        : meta.type === "movie"
          ? "movie"
          : fallbackType,
    name: meta.name,
    poster: meta.poster,
    releaseInfo: meta.releaseInfo,
    imdbRating: meta.imdbRating || undefined,
    genres: meta.genres,
  };
}

function toTitleDetail(meta: RawMeta, type: CatalogType): TitleDetail {
  return {
    id: meta.id ?? "",
    type,
    name: meta.name ?? "Untitled",
    poster: meta.poster,
    background: meta.background,
    logo: meta.logo,
    description: meta.description,
    releaseInfo: meta.releaseInfo,
    imdbRating: meta.imdbRating || undefined,
    runtime: meta.runtime,
    genres: meta.genres,
    cast: meta.cast,
    episodes: type === "series" ? toEpisodes(meta.videos ?? []) : [],
  };
}

/** Normalizes + sorts Cinemeta `videos`, dropping specials (season 0). */
function toEpisodes(videos: RawVideo[]): EpisodeInfo[] {
  return videos
    .map((video): EpisodeInfo | null => {
      const season = video.season;
      const episode = video.episode ?? video.number;
      if (season == null || episode == null) {
        return null;
      }
      return {
        id: video.id ?? "",
        season,
        episode,
        name: video.name ?? video.title ?? `Episode ${episode}`,
        overview: video.overview ?? video.description,
        thumbnail: video.thumbnail,
        released: video.released ?? video.firstAired,
      };
    })
    .filter((video): video is EpisodeInfo => video !== null && video.season > 0)
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
}
