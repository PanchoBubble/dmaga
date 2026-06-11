import "server-only";

import * as cheerio from "cheerio";

import { solveGet } from "@/lib/server/manga-providers/flaresolverr";
import type {
  DiscoverFeed,
  ProviderChapter,
  ProviderGenre,
  ProviderSeries,
  ProviderSeriesDetails,
} from "@/lib/server/manga-providers/types";

/**
 * VyManga (https://vymanga.net) has no public JSON API and is two-tiered behind
 * Cloudflare:
 *   - OPEN (plain fetch): `/search` (powers discover + title→id resolution).
 *   - CHALLENGED (Cloudflare "Just a moment…", 403 to plain fetch): the series
 *     page (`/manga/{slug}`, holds details + chapter list) and the chapter page
 *     (holds page images). These go through FlareSolverr via {@link solveGet}.
 *
 * Like the other scrapers, anything here can throw — the aggregator just drops
 * VyManga's contribution when it does.
 */
const BASE = "https://vymanga.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Plain fetch for VyManga's un-challenged endpoints (search). */
async function vyFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: `${BASE}/`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`VyManga request failed (${response.status}).`);
  }
  return response.text();
}

// --- id encoding -----------------------------------------------------------
// VyManga series/chapter URLs contain slashes, which a single Next dynamic
// route segment can't carry. So both ids are the base64url of their absolute
// URL — route-safe, and reversible to fetch the page. `id` (chapter) and
// `seriesId` share the same scheme.
function encodeId(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}
function decodeId(id: string): string {
  // Tolerate an already-absolute URL (defensive); else base64url-decode.
  return id.startsWith("http") ? id : Buffer.from(id, "base64url").toString("utf8");
}
/** Normalizes an href (absolute or root-relative) to an absolute URL. */
function absolute(href: string): string {
  return href.startsWith("http") ? href : `${BASE}${href.startsWith("/") ? "" : "/"}${href}`;
}

// --- discover + search (open endpoints) ------------------------------------

/** Maps a search result `.comic-item` to a {@link ProviderSeries}. */
function parseSeriesGrid(html: string): ProviderSeries[] {
  const $ = cheerio.load(html);
  const series: ProviderSeries[] = [];

  $(".comic-item").each((_, el) => {
    const item = $(el);
    const href = item.find("a").first().attr("href");
    if (!href) {
      return;
    }
    const seriesId = encodeId(absolute(href));
    const title = item.find(".comic-title").first().text().trim();
    const coverUrl =
      item.find(".comic-image img").first().attr("data-src")?.trim() ?? null;
    const latestChapter = item.find(".tray-item").first().text().trim() || null;
    if (seriesId && title) {
      series.push({ provider: "vymanga", seriesId, title, coverUrl, latestChapter });
    }
  });

  return series;
}

function searchUrl(params: Record<string, string | number>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `${BASE}/search?${search.toString()}`;
}

/** A provider-native discover feed (popular = most viewed, latest = updated). */
export async function listVyMangaFeed(
  feed: DiscoverFeed,
  page = 1,
): Promise<ProviderSeries[]> {
  const sort = feed === "latest" ? "updated_at" : "viewed";
  return parseSeriesGrid(await vyFetch(searchUrl({ sort, page })));
}

/** Browse one genre by its numeric id (most-viewed first). */
export async function listVyMangaByGenre(
  genreId: string,
  page = 1,
): Promise<ProviderSeries[]> {
  // `genre[]` is the multi-value filter VyManga's search form posts.
  const url = `${searchUrl({ sort: "viewed", page })}&genre%5B%5D=${encodeURIComponent(genreId)}`;
  return parseSeriesGrid(await vyFetch(url));
}

/** The full genre list, scraped from the search page filter checkboxes. */
export async function listVyMangaGenres(): Promise<ProviderGenre[]> {
  const $ = cheerio.load(await vyFetch(searchUrl({})));
  const genres: ProviderGenre[] = [];
  const seen = new Set<string>();

  $(".checkbox-genre").each((_, el) => {
    // data-value is "Name-<numericId>-<slug>"; names may contain dashes/spaces.
    const value = $(el).attr("data-value");
    const match = value?.match(/^(.*)-(\d+)-[^-]*$/);
    if (!match) {
      return;
    }
    const [, name, id] = match;
    if (!seen.has(id)) {
      seen.add(id);
      genres.push({ id, name: name.trim() });
    }
  });

  return genres;
}

// --- details + chapters + pages (Cloudflare-challenged, via FlareSolverr) ---

/** Parses the chapter list out of a solved series-page document. */
function parseChapters($: cheerio.CheerioAPI): ProviderChapter[] {
  const chapters: ProviderChapter[] = [];

  $(".list-group > a").each((_, el) => {
    const anchor = $(el);
    const href = anchor.attr("href");
    if (!href) {
      return;
    }
    const label = anchor.find("span").first().text().trim() || null;
    const number =
      label?.match(/\b(?:chapter|chap|episode|ep|ch)\.?\s*([\d.]+)/i)?.[1] ??
      label?.match(/(\d+(?:\.\d+)?)/)?.[1] ??
      null;
    const isPlainChapter = label ? /^chapter\s+[\d.]+$/i.test(label) : false;

    chapters.push({
      provider: "vymanga",
      id: encodeId(absolute(href)),
      number,
      volume: null,
      title: !label || isPlainChapter ? null : label,
      pages: null,
      lang: "en",
      group: null,
      publishedAt: null,
    });
  });

  return chapters;
}

/** Full series detail + chapters for the provider-native series page. */
export async function getVyMangaSeries(
  seriesId: string,
): Promise<ProviderSeriesDetails> {
  const $ = cheerio.load(await solveGet(decodeId(seriesId)));

  const title = $("h1").first().text().trim();
  const coverUrl = $(".img-manga img").first().attr("src")?.trim() ?? null;
  const description = $(".summary > .content").first().text().trim() || null;
  const author =
    $(".pre-title:contains(Author) ~ a").first().text().trim() || null;
  const status =
    $(".pre-title:contains(Status) ~ span:not(.space)").first().text().trim() ||
    $(".text-ongoing,.text-completed").first().text().trim() ||
    null;
  const genres = $(".pre-title:contains(Genres) ~ a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  return {
    provider: "vymanga",
    seriesId,
    title: title || seriesId,
    coverUrl,
    latestChapter: null,
    description,
    status,
    genres,
    author,
    chapters: parseChapters($),
  };
}

/** Resolves a chapter's ordered page-image URLs from its (solved) reader page. */
export async function getVyMangaPages(chapterId: string): Promise<string[]> {
  const $ = cheerio.load(await solveGet(decodeId(chapterId)));
  return $("img.d-block")
    .map((_, el) => $(el).attr("data-src")?.trim() ?? $(el).attr("src")?.trim())
    .get()
    .filter((src): src is string => Boolean(src) && src.startsWith("http"));
}
