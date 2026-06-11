/** Online manga reading providers (scanlation APIs) — how real readers work:
 * title → full chapter list → page images, served directly over HTTP. No
 * torrents, no Real-Debrid. */

export type MangaProviderKey = "mangadex" | "comick" | "weebcentral" | "vymanga";

/** Which provider-native discover feed to pull. */
export type DiscoverFeed = "latest" | "popular";

/** A series as it appears in a discover/browse grid (no chapter detail yet). */
export type ProviderSeries = {
  provider: MangaProviderKey;
  /** Provider-specific series id (used to resolve details/chapters). */
  seriesId: string;
  title: string;
  coverUrl: string | null;
  /** Latest chapter label when the feed reports one (e.g. "Chapter 210"). */
  latestChapter: string | null;
};

/** Full series detail for the provider-native series page. */
export type ProviderSeriesDetails = ProviderSeries & {
  description: string | null;
  status: string | null;
  genres: string[];
  author: string | null;
  chapters: ProviderChapter[];
};

/** A browsable genre/tag exposed by a provider. */
export type ProviderGenre = {
  id: string;
  name: string;
};

/** A single readable chapter from a provider. */
export type ProviderChapter = {
  provider: MangaProviderKey;
  /** Provider-specific chapter id (used to resolve pages). */
  id: string;
  /** Chapter number as a string (e.g. "10.5"); null for oneshots. */
  number: string | null;
  /** Volume number when the provider reports one. */
  volume: string | null;
  title: string | null;
  /** Page count when known. */
  pages: number | null;
  lang: string;
  /** Scanlation group / source label, when known. */
  group: string | null;
  /** ISO 8601 publish timestamp, when known. */
  publishedAt: string | null;
};

/** Parses a chapter number string to a sortable float (NaN-safe → Infinity). */
export function chapterSortValue(number: string | null): number {
  if (!number) {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = Number.parseFloat(number);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}
