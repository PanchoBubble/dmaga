import "server-only";

import { getComickPages } from "@/lib/server/manga-providers/comick";
import {
  findMangaDexId,
  getMangaDexPages,
  listMangaDexChapters,
} from "@/lib/server/manga-providers/mangadex";
import {
  findWeebCentralId,
  getWeebCentralPages,
  listWeebCentralChapters,
} from "@/lib/server/manga-providers/weebcentral";
import {
  getVyMangaPages,
  getVyMangaSeries,
  listVyMangaByGenre,
  listVyMangaFeed,
  listVyMangaGenres,
} from "@/lib/server/manga-providers/vymanga";
import {
  chapterSortValue,
  type DiscoverFeed,
  type MangaProviderKey,
  type ProviderChapter,
  type ProviderGenre,
  type ProviderSeries,
  type ProviderSeriesDetails,
} from "@/lib/server/manga-providers/types";

export type { ProviderChapter } from "@/lib/server/manga-providers/types";

/** Providers that expose a browsable discover feed / native series pages. */
export const DISCOVER_PROVIDERS: MangaProviderKey[] = ["vymanga"];

/**
 * Builds the merged chapter list for a manga from all providers: dedupes by
 * chapter number (first provider wins — MangaDex is tried first) and sorts
 * ascending. Each provider is isolated so one being down just drops its
 * contribution. Returns the providers that actually returned chapters.
 */
export async function getMergedChapters(
  malId: number | string | undefined,
  title: string,
): Promise<{ chapters: ProviderChapter[]; sources: MangaProviderKey[] }> {
  // MangaDex first so it wins ties; Weeb Central fills what MangaDex lacks
  // (notably licensed titles like Solo Leveling, which MangaDex only keeps as
  // unreadable external redirects). Comick is omitted — its API moved behind
  // Cloudflare (api.comick.fun is dead); comick.ts stays for a future revival.
  // VyManga is intentionally NOT merged here: its chapters need a FlareSolverr
  // solve (~10-40s), which would gate every MAL manga page on a slow headless
  // round-trip. VyManga reading is served by its provider-native series route
  // (/manga/series/vymanga/...) instead, reached via Discover.
  const settled = await Promise.allSettled([
    listFromMangaDex(malId, title),
    listFromWeebCentral(title),
  ]);

  const sources: MangaProviderKey[] = [];
  const byNumber = new Map<string, ProviderChapter>();

  for (const result of settled) {
    if (result.status !== "fulfilled" || result.value.length === 0) {
      continue;
    }
    sources.push(result.value[0].provider);
    for (const chapter of result.value) {
      // One readable source per chapter number; oneshots keyed by id.
      const key = chapter.number ?? `oneshot:${chapter.id}`;
      if (!byNumber.has(key)) {
        byNumber.set(key, chapter);
      }
    }
  }

  const chapters = [...byNumber.values()].sort(
    (a, b) => chapterSortValue(a.number) - chapterSortValue(b.number),
  );

  return { chapters, sources };
}

/** Resolves a chapter's page-image URLs, dispatching by provider. */
export async function getChapterPages(
  provider: MangaProviderKey,
  chapterId: string,
): Promise<string[]> {
  if (provider === "mangadex") {
    return getMangaDexPages(chapterId);
  }
  if (provider === "comick") {
    return getComickPages(chapterId);
  }
  if (provider === "weebcentral") {
    return getWeebCentralPages(chapterId);
  }
  if (provider === "vymanga") {
    return getVyMangaPages(chapterId);
  }
  return [];
}

/**
 * Provider-native discover feed (latest/popular), aggregated across providers
 * that support browsing. Each provider is isolated — a failing one drops out.
 */
export async function getDiscoverFeed(
  feed: DiscoverFeed,
  page: number,
  provider?: MangaProviderKey,
): Promise<ProviderSeries[]> {
  const providers = provider ? [provider] : DISCOVER_PROVIDERS;
  const settled = await Promise.allSettled(
    providers.map((key) => discoverFor(key).listFeed(feed, page)),
  );
  return settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

/** Browse one provider's genre by id. */
export async function getDiscoverByGenre(
  provider: MangaProviderKey,
  genreId: string,
  page: number,
): Promise<ProviderSeries[]> {
  return discoverFor(provider).listByGenre(genreId, page);
}

/** A provider's genre list for the browse filter. */
export async function getGenres(
  provider: MangaProviderKey,
): Promise<ProviderGenre[]> {
  return discoverFor(provider).listGenres();
}

/** Full provider-native series detail (header + chapters), keyed by provider. */
export async function getSeriesNative(
  provider: MangaProviderKey,
  seriesId: string,
): Promise<ProviderSeriesDetails> {
  return discoverFor(provider).getSeries(seriesId);
}

type DiscoverCapability = {
  listFeed: (feed: DiscoverFeed, page: number) => Promise<ProviderSeries[]>;
  listByGenre: (genreId: string, page: number) => Promise<ProviderSeries[]>;
  listGenres: () => Promise<ProviderGenre[]>;
  getSeries: (seriesId: string) => Promise<ProviderSeriesDetails>;
};

/** Per-provider discover implementations. Extend as providers gain browsing. */
function discoverFor(provider: MangaProviderKey): DiscoverCapability {
  if (provider === "vymanga") {
    return {
      listFeed: listVyMangaFeed,
      listByGenre: listVyMangaByGenre,
      listGenres: listVyMangaGenres,
      getSeries: getVyMangaSeries,
    };
  }
  throw new Error(`Provider "${provider}" does not support discover.`);
}

async function listFromMangaDex(
  malId: number | string | undefined,
  title: string,
): Promise<ProviderChapter[]> {
  const seriesId = await findMangaDexId(malId, title);
  if (!seriesId) {
    return [];
  }
  return listMangaDexChapters(seriesId);
}

async function listFromWeebCentral(title: string): Promise<ProviderChapter[]> {
  const seriesId = await findWeebCentralId(title);
  if (!seriesId) {
    return [];
  }
  return listWeebCentralChapters(seriesId);
}

