import type { ProviderChapter } from "@/lib/server/manga-providers/types";

const BASE = "https://api.mangadex.org";
const UA = "dmaga/1.0 (self-hosted manga reader)";
const CONTENT_RATINGS = ["safe", "suggestive", "erotica", "pornographic"];

type MdManga = {
  id?: string;
  attributes?: { links?: { mal?: string } | null };
};

type MdChapter = {
  id?: string;
  attributes?: {
    chapter?: string | null;
    volume?: string | null;
    title?: string | null;
    pages?: number;
    translatedLanguage?: string;
    externalUrl?: string | null;
    publishAt?: string | null;
  };
  relationships?: { type?: string; attributes?: { name?: string } }[];
};

async function mdFetch(url: URL): Promise<unknown> {
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`MangaDex request failed (${response.status}).`);
  }
  return response.json();
}

/**
 * Resolves a MangaDex series id from the MAL id (preferred — exact match via
 * the manga's `links.mal`) or the title (best search hit otherwise).
 */
export async function findMangaDexId(
  malId: number | string | undefined,
  title: string,
): Promise<string | null> {
  const url = new URL(`${BASE}/manga`);
  url.searchParams.set("title", title);
  url.searchParams.set("limit", "10");
  for (const rating of CONTENT_RATINGS) {
    url.searchParams.append("contentRating[]", rating);
  }

  const payload = (await mdFetch(url)) as { data?: MdManga[] };
  const list = payload.data ?? [];

  if (malId !== undefined) {
    const exact = list.find(
      (manga) => String(manga.attributes?.links?.mal ?? "") === String(malId),
    );
    if (exact?.id) {
      return exact.id;
    }
  }

  return list[0]?.id ?? null;
}

/**
 * Fetches the full English chapter list for a series, paginating the feed and
 * dropping external (no-pages) chapters. Not deduplicated — the aggregator
 * collapses duplicate chapter numbers across providers.
 */
export async function listMangaDexChapters(
  seriesId: string,
): Promise<ProviderChapter[]> {
  const chapters: ProviderChapter[] = [];
  let offset = 0;

  for (let guard = 0; guard < 40; guard += 1) {
    const url = new URL(`${BASE}/manga/${seriesId}/feed`);
    url.searchParams.append("translatedLanguage[]", "en");
    url.searchParams.set("order[volume]", "asc");
    url.searchParams.set("order[chapter]", "asc");
    url.searchParams.set("limit", "500");
    url.searchParams.set("offset", String(offset));
    url.searchParams.append("includes[]", "scanlation_group");
    for (const rating of CONTENT_RATINGS) {
      url.searchParams.append("contentRating[]", rating);
    }

    const payload = (await mdFetch(url)) as {
      data?: MdChapter[];
      total?: number;
    };
    const page = payload.data ?? [];

    for (const chapter of page) {
      const attributes = chapter.attributes ?? {};
      // External chapters point off-site (no pages we can serve) — skip them.
      if (attributes.externalUrl || !attributes.pages) {
        continue;
      }
      chapters.push({
        provider: "mangadex",
        id: chapter.id ?? "",
        number: attributes.chapter ?? null,
        volume: attributes.volume ?? null,
        title: attributes.title ?? null,
        pages: attributes.pages ?? null,
        lang: attributes.translatedLanguage ?? "en",
        group:
          chapter.relationships?.find((rel) => rel.type === "scanlation_group")
            ?.attributes?.name ?? null,
        publishedAt: attributes.publishAt ?? null,
      });
    }

    offset += 500;
    if (offset >= (payload.total ?? 0) || page.length === 0) {
      break;
    }
  }

  return chapters;
}

/** Resolves a chapter's ordered page-image URLs via the at-home server. */
export async function getMangaDexPages(chapterId: string): Promise<string[]> {
  const payload = (await mdFetch(
    new URL(`${BASE}/at-home/server/${chapterId}`),
  )) as { baseUrl?: string; chapter?: { hash?: string; data?: string[] } };

  const baseUrl = payload.baseUrl;
  const hash = payload.chapter?.hash;
  const files = payload.chapter?.data ?? [];
  if (!baseUrl || !hash) {
    return [];
  }

  return files.map((file) => `${baseUrl}/data/${hash}/${file}`);
}
