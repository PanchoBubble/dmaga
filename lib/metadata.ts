/**
 * Cinemeta-backed metadata model for the Stremio-style browse experience.
 * These types are client-safe (no server imports) so both the Discover pages
 * and the title detail page can share them. The server fetchers live in
 * `lib/server/metadata/cinemeta.ts`; the API proxy in `app/api/catalog`.
 */

/** Cinemeta content type. We surface movies and series ("Shows" in the UI). */
export type CatalogType = "movie" | "series";

/** A single tile in a browse grid (Cinemeta catalog `metas[]` entry). */
export type CatalogItem = {
  /** IMDB id (e.g. `tt0903747`). */
  id: string;
  type: CatalogType;
  name: string;
  /** Poster URL (usually `images.metahub.space`); may be absent. */
  poster?: string;
  /** Release year or range, e.g. `2008` or `2008–2013`. */
  releaseInfo?: string;
  /** IMDB rating as a string like `9.5`; empty when unrated. */
  imdbRating?: string;
  genres?: string[];
};

/** One episode of a series (Cinemeta meta `videos[]` entry). */
export type EpisodeInfo = {
  /** Stremio video id, `tt123:season:episode`. */
  id: string;
  season: number;
  episode: number;
  name: string;
  overview?: string;
  thumbnail?: string;
  /** ISO release date, when known. */
  released?: string;
};

/** Full detail for one title (Cinemeta `meta`), plus episodes for series. */
export type TitleDetail = {
  id: string;
  type: CatalogType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  runtime?: string;
  genres?: string[];
  cast?: string[];
  /** Episodes grouped flat; empty for movies. Sorted by season then episode. */
  episodes: EpisodeInfo[];
};

/** Cinemeta catalog ids exposed in the UI, with display labels. */
export const catalogSorts = [
  { id: "top", label: "Popular" },
  { id: "year", label: "New" },
  { id: "imdbRating", label: "Featured" },
] as const;

export type CatalogSort = (typeof catalogSorts)[number]["id"];

/** Genres Cinemeta accepts via the `genre=` extra on the `top` catalog. */
export const catalogGenres = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
] as const;

/** UI route segments (`/discover/movie`) mapped to display labels. */
export const catalogTypes: { type: CatalogType; label: string }[] = [
  { type: "movie", label: "Movies" },
  { type: "series", label: "Shows" },
];

/** Narrows an arbitrary string to a {@link CatalogType}, else null. */
export function asCatalogType(value: string | undefined): CatalogType | null {
  return value === "movie" || value === "series" ? value : null;
}

/**
 * Builds the keyword query a torrent indexer (Torznab/Cardigann) understands
 * for a title. Movies use `name year`; episodes use `name SxxEyy`. Torrentio
 * ignores this and uses the IMDB id directly (threaded separately).
 */
export function buildSourceQuery(input: {
  name: string;
  releaseInfo?: string;
  season?: number;
  episode?: number;
}): string {
  const { name, releaseInfo, season, episode } = input;
  if (season != null && episode != null) {
    const tag = `S${pad(season)}E${pad(episode)}`;
    return `${name} ${tag}`;
  }
  // Movies: append the leading 4-digit year when present to disambiguate.
  const year = releaseInfo?.match(/\d{4}/)?.[0];
  return year ? `${name} ${year}` : name;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
