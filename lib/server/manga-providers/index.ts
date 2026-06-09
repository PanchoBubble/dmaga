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
  chapterSortValue,
  type MangaProviderKey,
  type ProviderChapter,
} from "@/lib/server/manga-providers/types";

export type { ProviderChapter } from "@/lib/server/manga-providers/types";

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
  return [];
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
