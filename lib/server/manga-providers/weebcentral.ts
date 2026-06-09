import type { ProviderChapter } from "@/lib/server/manga-providers/types";

// Weeb Central has no JSON API — these endpoints return HTML that we parse with
// bounded regexes. HTML scraping is inherently fragile: if the site markup
// changes these break, and the aggregator drops Weeb Central if it throws.
const BASE = "https://weebcentral.com";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function wcFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html", Referer: `${BASE}/` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Weeb Central request failed (${response.status}).`);
  }
  return response.text();
}

/** Finds a series id by title — top "Best Match" search hit. */
export async function findWeebCentralId(title: string): Promise<string | null> {
  const url =
    `${BASE}/search/data?text=${encodeURIComponent(title)}` +
    `&sort=Best+Match&order=Descending&official=Any&display_mode=Minimal+Display&limit=5`;
  const html = await wcFetch(url);
  return html.match(/weebcentral\.com\/series\/([A-Z0-9]+)\//)?.[1] ?? null;
}

/** Parses the full chapter list for a series. */
export async function listWeebCentralChapters(
  seriesId: string,
): Promise<ProviderChapter[]> {
  const html = await wcFetch(`${BASE}/series/${seriesId}/full-chapter-list`);

  const chapters: ProviderChapter[] = [];
  const seen = new Set<string>();
  // Each chapter is an <a href=".../chapters/{id}"> … </a> block containing an
  // SVG icon then a "Chapter N" title. Capture the whole anchor and pull the
  // number from anywhere inside (the title sits well past the href).
  const anchorPattern = /\/chapters\/([A-Z0-9]+)"[\s\S]*?<\/a>/g;

  for (const match of html.matchAll(anchorPattern)) {
    const id = match[1];
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    chapters.push({
      provider: "weebcentral",
      id,
      number: match[0].match(/Chapter\s+([\d.]+)/i)?.[1] ?? null,
      volume: null,
      title: null,
      pages: null,
      lang: "en",
      group: null,
      publishedAt: null,
    });
  }

  return chapters;
}

/** Resolves a chapter's ordered page-image URLs from its long-strip view. */
export async function getWeebCentralPages(chapterId: string): Promise<string[]> {
  const html = await wcFetch(
    `${BASE}/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`,
  );
  return [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((src) => src.startsWith("https://"));
}
