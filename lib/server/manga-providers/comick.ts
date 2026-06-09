import type { ProviderChapter } from "@/lib/server/manga-providers/types";

// Comick's API is community-reverse-engineered (used by Tachiyomi/Mihon) and
// can rate-limit or move domains — every call is best-effort and the aggregator
// drops Comick if it throws.
const BASE = "https://api.comick.fun";
const UA = "dmaga/1.0 (self-hosted manga reader)";
const IMAGE_BASE = "https://meo.comick.pictures";

async function ckFetch(path: string): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Comick request failed (${response.status}).`);
  }
  return response.json();
}

type CkSearchHit = { hid?: string; slug?: string; title?: string };
type CkChapter = {
  hid?: string;
  chap?: string | null;
  vol?: string | null;
  title?: string | null;
  lang?: string;
  group_name?: string[] | null;
  created_at?: string | null;
};

/** Finds a Comick comic id (hid) by title — top relevance hit. */
export async function findComickId(title: string): Promise<string | null> {
  const hits = (await ckFetch(
    `/v1.0/search?q=${encodeURIComponent(title)}&limit=8`,
  )) as CkSearchHit[];
  return Array.isArray(hits) ? hits[0]?.hid ?? null : null;
}

/** Lists English chapters for a comic, paginating the chapters endpoint. */
export async function listComickChapters(
  comicHid: string,
): Promise<ProviderChapter[]> {
  const chapters: ProviderChapter[] = [];

  for (let page = 1; page <= 30; page += 1) {
    const payload = (await ckFetch(
      `/comic/${comicHid}/chapters?lang=en&page=${page}&limit=100&chap-order=1`,
    )) as { chapters?: CkChapter[]; total?: number };
    const batch = payload.chapters ?? [];

    for (const chapter of batch) {
      if (!chapter.hid) {
        continue;
      }
      chapters.push({
        provider: "comick",
        id: chapter.hid,
        number: chapter.chap ?? null,
        volume: chapter.vol ?? null,
        title: chapter.title ?? null,
        pages: null,
        lang: chapter.lang ?? "en",
        group: chapter.group_name?.filter(Boolean).join(", ") || null,
        publishedAt: chapter.created_at ?? null,
      });
    }

    if (batch.length < 100 || chapters.length >= (payload.total ?? 0)) {
      break;
    }
  }

  return chapters;
}

/** Resolves a chapter's ordered page-image URLs. */
export async function getComickPages(chapterHid: string): Promise<string[]> {
  const payload = (await ckFetch(`/chapter/${chapterHid}?tachiyomi=true`)) as {
    chapter?: { md_images?: { b2key?: string }[] };
  };
  return (payload.chapter?.md_images ?? [])
    .map((image) => image.b2key)
    .filter((key): key is string => Boolean(key))
    .map((key) => `${IMAGE_BASE}/${key}`);
}
