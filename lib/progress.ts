/** Reading-progress shapes shared between client and server. */

/** Per-chapter read state, keyed by unitKey within a series. */
export type ChapterProgress = {
  unitKey: string;
  completed: boolean;
  lastPage: number;
};

/** Series-level resume point. */
export type SeriesProgress = {
  seriesKey: string;
  lastProvider: string | null;
  lastChapterId: string | null;
  lastChapterNumber: string | null;
  lastPage: number;
};

/** GET /api/manga/progress response: the series resume point + a unit map. */
export type ProgressResponse = {
  series: SeriesProgress | null;
  units: Record<string, ChapterProgress>;
};

/** POST /api/manga/progress body — upserts one chapter's read state. */
export type ProgressUpsert = {
  seriesKey: string;
  source: string;
  title: string;
  coverUrl?: string | null;
  mediaKind?: string;
  provider: string;
  chapterId: string;
  number?: string | null;
  unitKey: string;
  lastPage: number;
  completed: boolean;
  pageCount?: number | null;
};

/** A row in the "Continue reading" rail. */
export type ContinueReadingItem = {
  seriesKey: string;
  source: string;
  title: string;
  coverUrl: string | null;
  lastProvider: string | null;
  lastChapterId: string | null;
  lastChapterNumber: string | null;
  lastPage: number;
  updatedAt: string;
};

/** Canonical series key: `mal:{id}` or `{provider}:{seriesId}`. */
export function malSeriesKey(malId: number | string): string {
  return `mal:${malId}`;
}
export function nativeSeriesKey(provider: string, seriesId: string): string {
  return `${provider}:${seriesId}`;
}

/** Stable per-chapter key: the chapter number when known, else its id. */
export function chapterUnitKey(
  number: string | null | undefined,
  chapterId: string,
): string {
  return number ? number : `id:${chapterId}`;
}
