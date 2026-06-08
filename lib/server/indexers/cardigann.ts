import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";

import { fetchIndexerBytes, fetchIndexerText } from "@/lib/server/indexers/fetch";
import {
  infoHashFromMagnet,
  magnetFromInfoHash,
  normalizeHash,
} from "@/lib/server/indexers/info-hash";
import {
  IndexerError,
  type IndexerAdapter,
  type IndexerConfig,
  type IndexerTestOutcome,
  type IndexerType,
  type TorrentSearchParams,
  type TorrentSearchResult,
} from "@/lib/server/indexers/types";

const rssParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseAttributeValue: false,
  isArray: (name) => name === "item",
});

type CardigannDefinition = {
  readonly key: string;
  readonly search: (
    config: IndexerConfig,
    params: TorrentSearchParams,
  ) => Promise<TorrentSearchResult[]>;
};

type RssItem = {
  title?: unknown;
  guid?: unknown;
  link?: unknown;
  comments?: unknown;
  pubDate?: unknown;
  size?: unknown;
  seeders?: unknown;
  leechers?: unknown;
  peers?: unknown;
  infoHash?: unknown;
  enclosure?: { "@_url"?: string; "@_length"?: string };
};

type YtsResponse = {
  status?: string;
  status_message?: string;
  data?: {
    movies?: Array<{
      title_long?: string;
      title?: string;
      year?: number;
      url?: string;
      torrents?: Array<{
        hash?: string;
        url?: string;
        quality?: string;
        type?: string;
        size_bytes?: number;
        seeds?: number;
        peers?: number;
        date_uploaded_unix?: number;
      }>;
    }>;
  };
};

type PirateBayItem = {
  id?: string;
  name?: string;
  info_hash?: string;
  leechers?: string;
  seeders?: string;
  size?: string;
  added?: string;
};

type KnabenResponse = {
  hits?: Array<{
    title?: string;
    hash?: string;
    magnetUrl?: string;
    bytes?: number;
    seeders?: number;
    peers?: number;
    date?: string;
    details?: string;
  }>;
};

type SolidTorrentsResponse = {
  results?: Array<{
    id?: string;
    infohash?: string;
    title?: string;
    size?: number;
    seeders?: number;
    leechers?: number;
    updatedAt?: string;
  }>;
};

type TheRarbgResponse = {
  results?: Array<{
    pk?: string;
    /** name */
    n?: string;
    /** added (unix seconds) */
    a?: number;
    /** size in bytes */
    s?: number;
    /** seeders */
    se?: number;
    /** leechers */
    le?: number;
    /** info hash */
    h?: string;
  }>;
};

export class CardigannIndexerAdapter implements IndexerAdapter {
  readonly type: IndexerType = "cardigann";

  async search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]> {
    return definitionFor(config).search(config, params);
  }

  async test(config: IndexerConfig): Promise<IndexerTestOutcome> {
    const results = await this.search(config, { query: "ubuntu", limit: 1 });
    const suffix = results.length === 1 ? " and returned a result" : "";
    return { ok: true, message: `Cardigann preset responded${suffix}.` };
  }
}

function definitionFor(config: IndexerConfig): CardigannDefinition {
  const presetKey = presetKeyOf(config);
  const definition = presetKey ? definitions[presetKey] : undefined;
  if (!definition) {
    throw new IndexerError(
      "This Prowlarr/Cardigann public definition is not implemented yet.",
      { indexerId: config.id, indexerName: config.name },
    );
  }
  return definition;
}

const definitions: Record<string, CardigannDefinition> = {
  "anime-nyaa-si": {
    key: "anime-nyaa-si",
    search: searchNyaa,
  },
  "prowlarr-public-1337x": {
    key: "prowlarr-public-1337x",
    search: async (config, params) => {
      const page = new URL(
        `/sort-search/${encodeURIComponent(params.query)}/seeders/desc/1/`,
        config.baseUrl,
      );
      const html = await fetchIndexerText(config, page.toString());
      return normalize1337x(config, html, params.limit);
    },
  },
  "prowlarr-public-anisource": {
    key: "prowlarr-public-anisource",
    search: async (config, params) => {
      const url = new URL("/", config.baseUrl);
      url.searchParams.set("search", params.query);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeAniSource(config, html, params.limit);
    },
  },
  "prowlarr-public-damagnet": {
    key: "prowlarr-public-damagnet",
    search: async (config, params) => {
      const url = new URL("/", config.baseUrl);
      url.searchParams.set("q", params.query || String(new Date().getFullYear()));
      url.searchParams.set("wanted", "100");
      const html = await fetchIndexerText(config, url.toString());
      return normalizeDaMagnet(config, html, params.limit);
    },
  },
  "prowlarr-public-ebookbay": {
    key: "prowlarr-public-ebookbay",
    search: async (config, params) => {
      const pages = ["/", "/page/2/", "/page/3/", "/page/4/", "/page/5/"];
      const bodies = await Promise.all(
        pages.map(async (path) => {
          const url = new URL(path, config.baseUrl);
          url.searchParams.set("s", params.query);
          return fetchIndexerText(config, url.toString()).catch(() => "");
        }),
      );
      return normalizeEBookBay(config, bodies.join("\n"), params.limit);
    },
  },
  "prowlarr-public-ehentai": {
    key: "prowlarr-public-ehentai",
    search: async (config, params) => {
      const url = new URL("/", config.baseUrl);
      url.searchParams.set("f_search", params.query);
      url.searchParams.set("f_cats", "0");
      const html = await fetchIndexerText(config, url.toString());
      return normalizeEHentai(config, html, params.limit);
    },
  },
  "prowlarr-public-eztv": {
    key: "prowlarr-public-eztv",
    search: async (config, params) => {
      const path = params.query ? `/search/${slugifySearch(params.query)}` : "/home";
      const url = new URL(path, config.baseUrl);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeEztv(config, html, params.limit);
    },
  },
  "prowlarr-public-nyaasi": {
    key: "prowlarr-public-nyaasi",
    search: searchNyaa,
  },
  "prowlarr-public-yts": {
    key: "prowlarr-public-yts",
    search: async (config, params) => {
      const url = new URL("/api/v2/list_movies.json", config.baseUrl);
      url.searchParams.set("query_term", params.query);
      url.searchParams.set("limit", String(Math.min(params.limit ?? 20, 50)));
      const payload = parseJson<YtsResponse>(
        config,
        await fetchIndexerText(config, url.toString()),
      );
      if (payload.status && payload.status !== "ok") {
        throw new IndexerError(
          payload.status_message ?? "YTS returned an error response.",
          { indexerId: config.id, indexerName: config.name },
        );
      }
      return normalizeYts(config, payload, params.limit);
    },
  },
  "prowlarr-public-thepiratebay": {
    key: "prowlarr-public-thepiratebay",
    search: async (config, params) => {
      const url = new URL("/q.php", "https://apibay.org");
      url.searchParams.set("q", params.query);
      const category = firstCategory(params, config);
      if (category) {
        url.searchParams.set("cat", category);
      }
      const payload = parseJson<PirateBayItem[]>(
        config,
        await fetchIndexerText(config, url.toString()),
      );
      return normalizePirateBay(config, payload, params.limit);
    },
  },
  "prowlarr-public-limetorrents": {
    key: "prowlarr-public-limetorrents",
    search: async (config, params) => {
      const url = new URL(
        `/search/all/${slugifySearch(params.query)}/seeds/1/`,
        config.baseUrl,
      );
      const html = await fetchIndexerText(config, url.toString());
      return normalizeLimeTorrents(config, html, params.limit);
    },
  },
  "prowlarr-public-torrentdownloads": {
    key: "prowlarr-public-torrentdownloads",
    search: async (config, params) => {
      const url = new URL("/search/", config.baseUrl);
      url.searchParams.set("search", params.query);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeTorrentDownloads(config, html, params.limit);
    },
  },
  "prowlarr-public-torrentdownload": {
    key: "prowlarr-public-torrentdownload",
    search: async (config, params) => {
      const url = new URL("/search", config.baseUrl);
      url.searchParams.set("q", params.query);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeTorrentDownload(config, html, params.limit);
    },
  },
  "prowlarr-public-gamestorrents": {
    key: "prowlarr-public-gamestorrents",
    search: async (config, params) => {
      const url = new URL("/", config.baseUrl);
      url.searchParams.set("s", params.query);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeGamesTorrents(config, html, params.limit);
    },
  },
  "prowlarr-public-kickasstorrents-to": {
    key: "prowlarr-public-kickasstorrents-to",
    search: async (config, params) => {
      const path = params.query
        ? `/search/?q=${encodeURIComponent(params.query)}`
        : "/17/All/";
      const html = await fetchIndexerText(config, new URL(path, config.baseUrl).toString());
      return normalizeKickassTo(config, html, params.limit);
    },
  },
  "prowlarr-public-kickasstorrents-ws": {
    key: "prowlarr-public-kickasstorrents-ws",
    search: async (config, params) => {
      const path = params.query
        ? `/usearch/${encodeURIComponent(params.query)}/?field=seeders&sorder=desc`
        : "/new/?field=seeders&sorder=desc";
      const html = await fetchIndexerText(config, new URL(path, config.baseUrl).toString());
      return normalizeKickassWs(config, html, params.limit);
    },
  },
  "prowlarr-public-linuxtracker": {
    key: "prowlarr-public-linuxtracker",
    search: async (config, params) => {
      const url = new URL("/index.php", config.baseUrl);
      url.searchParams.set("page", "torrents");
      url.searchParams.set("search", params.query);
      url.searchParams.set("category", firstCategory(params, config) ?? "0");
      url.searchParams.set("active", "1");
      url.searchParams.set("order", "3");
      url.searchParams.set("by", "2");
      const html = await fetchIndexerText(config, url.toString());
      return normalizeLinuxTracker(config, html, params.limit);
    },
  },
  "prowlarr-public-mactorrentsdownload": {
    key: "prowlarr-public-mactorrentsdownload",
    search: async (config, params) => {
      const url = new URL("/", config.baseUrl);
      url.searchParams.set("s", params.query);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeMacTorrentsDownload(config, html, params.limit);
    },
  },
  "prowlarr-public-nipponsei": {
    key: "prowlarr-public-nipponsei",
    search: async (config, params) => {
      const url = new URL("/index.php", config.baseUrl);
      url.searchParams.set("section", "Tracker");
      url.searchParams.set("search", params.query);
      const html = await fetchIndexerText(config, url.toString());
      return normalizeNipponsei(config, html, params.limit);
    },
  },
  "prowlarr-public-pctorrent": {
    key: "prowlarr-public-pctorrent",
    search: async (config, params) => {
      const url = new URL("/", config.baseUrl);
      if (params.query) {
        url.searchParams.set("do", "search");
        url.searchParams.set("subaction", "search");
        url.searchParams.set("search_start", "0");
        url.searchParams.set("full_search", "1");
        url.searchParams.set("result_from", "1");
        url.searchParams.set("story", params.query);
      }
      const html = await fetchIndexerText(config, url.toString());
      return normalizePcTorrent(config, html, params.limit);
    },
  },
  "prowlarr-public-torrentgalaxyclone": {
    key: "prowlarr-public-torrentgalaxyclone",
    search: async (config, params) => {
      // torrentgalaxy.one is a TheRARBG-style frontend: its keyword listing has
      // no inline magnets (the listing's magnet anchor is JS-populated), but the
      // same path serves a JSON view carrying info hashes via `?format=json`.
      // We use that and skip HTML scraping + detail-page round-trips entirely.
      const url = new URL(
        `/get-posts/keywords:${encodeURIComponent(params.query)}/`,
        config.baseUrl,
      );
      url.searchParams.set("format", "json");
      const payload = parseJson<TheRarbgResponse>(
        config,
        await fetchIndexerText(config, url.toString()),
      );
      return normalizeTheRarbg(config, payload, params.limit);
    },
  },
  "prowlarr-public-knaben": {
    key: "prowlarr-public-knaben",
    search: async (config, params) => {
      // Knaben is a meta-search aggregator with a JSON API (POST). We pass the
      // query alone and let the search layer's seeder sort rank results;
      // forcing `order_by: seeders` here would surface high-seed but
      // irrelevant torrents instead of query matches.
      const url = new URL("/v1", config.baseUrl);
      const body = JSON.stringify({
        query: params.query,
        size: Math.min(params.limit ?? 50, 100),
        hide_unsafe: true,
        hide_xxx: true,
      });
      const payload = parseJson<KnabenResponse>(
        config,
        await fetchIndexerText(config, url.toString(), { method: "POST", body }),
      );
      return normalizeKnaben(config, payload, params.limit);
    },
  },
  "prowlarr-public-solidtorrents": {
    key: "prowlarr-public-solidtorrents",
    search: async (config, params) => {
      const url = new URL("/api/v1/search", config.baseUrl);
      url.searchParams.set("q", params.query);
      url.searchParams.set("sort", "seeders");
      url.searchParams.set("limit", String(Math.min(params.limit ?? 50, 100)));
      const payload = parseJson<SolidTorrentsResponse>(
        config,
        await fetchIndexerText(config, url.toString()),
      );
      return normalizeSolidTorrents(config, payload, params.limit);
    },
  },
  "prowlarr-public-therarbg": {
    key: "prowlarr-public-therarbg",
    search: async (config, params) => {
      // TheRARBG exposes a JSON view of its keyword listing via `?format=json`,
      // which carries the info hash directly — no detail-page round-trip.
      const url = new URL(
        `/get-posts/keywords:${encodeURIComponent(params.query)}/`,
        config.baseUrl,
      );
      url.searchParams.set("format", "json");
      const payload = parseJson<TheRarbgResponse>(
        config,
        await fetchIndexerText(config, url.toString()),
      );
      return normalizeTheRarbg(config, payload, params.limit);
    },
  },
  "prowlarr-public-torrentby": {
    key: "prowlarr-public-torrentby",
    search: async (config, params) => {
      const url = new URL(params.query ? "/search/" : "/today/", config.baseUrl);
      if (params.query) {
        url.searchParams.set("search", params.query);
        url.searchParams.set("category", "0");
      }
      const html = await fetchIndexerText(config, url.toString());
      return normalizeTorrentBy(config, html, params.limit);
    },
  },
  "prowlarr-public-torrentcore": {
    key: "prowlarr-public-torrentcore",
    search: async (config, params) => {
      const path = params.query
        ? `/search?s=${encodeURIComponent(params.query)}`
        : "/index";
      const html = await fetchIndexerText(config, new URL(path, config.baseUrl).toString());
      return normalizeTorrentCore(config, html, params.limit);
    },
  },
  "anime-tokyo-toshokan": {
    key: "anime-tokyo-toshokan",
    search: searchTokyoToshokan,
  },
  "prowlarr-public-tokyotosho": {
    key: "prowlarr-public-tokyotosho",
    search: searchTokyoToshokan,
  },
};

async function searchNyaa(
  config: IndexerConfig,
  params: TorrentSearchParams,
): Promise<TorrentSearchResult[]> {
  const url = new URL(config.baseUrl);
  url.searchParams.set("page", "rss");
  url.searchParams.set("q", params.query);
  const category = firstCategory(params, config);
  if (category) {
    url.searchParams.set("c", category);
  }
  const xml = await fetchIndexerText(config, url.toString());
  return parseRss(config, xml, params.limit);
}

async function searchTokyoToshokan(
  config: IndexerConfig,
  params: TorrentSearchParams,
): Promise<TorrentSearchResult[]> {
  const url = new URL("/rss.php", config.baseUrl);
  url.searchParams.set("terms", params.query);
  const category = firstCategory(params, config);
  if (category) {
    url.searchParams.set("type", category);
  }
  const xml = await fetchIndexerText(config, url.toString());
  return parseRss(config, xml, params.limit);
}

async function normalize1337x(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const rows = [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /href=["']\/torrent\//i.test(row))
    .slice(0, limit ?? 20);

  const results = await Promise.all(
    rows.map(async (row) => {
      const titleLink = row.match(
        /<a\b[^>]*href=["'](\/torrent\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      const detailPath = htmlDecode(titleLink?.[1]);
      const title = cleanText(titleLink?.[2]) ?? "Untitled";
      const detailUrl = detailPath
        ? new URL(detailPath, config.baseUrl).toString()
        : undefined;
      const magnetUrl = detailUrl
        ? pickMagnet(await fetchIndexerText(config, detailUrl).catch(() => ""))
        : undefined;
      const infoHash = infoHashFromMagnet(magnetUrl);

      return {
        id: `${config.id}:${infoHash ?? detailPath ?? title}`,
        title,
        sizeBytes: parseSize(cellByClass(row, "coll-4")),
        seeders: toNumber(cellByClass(row, "coll-2")),
        leechers: toNumber(cellByClass(row, "coll-3")),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl,
        infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );

  return results.filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeEztv(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[^>]*name=["']hover["'][\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /magnet:\?xt=urn:btih:/i.test(row))
    .slice(0, limit ?? 20)
    .map((row) => {
      const cells = tableCells(row);
      const titleMatch = row.match(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/a>/i,
      );
      const magnetUrl = pickMagnet(htmlDecode(row));
      const infoHash = infoHashFromMagnet(magnetUrl);
      const sourceUrlRaw = htmlDecode(titleMatch?.[1]);
      const title =
        cleanText(titleMatch?.[2]) ?? cleanText(titleMatch?.[3]) ?? "Untitled";

      return {
        id: `${config.id}:${infoHash ?? sourceUrlRaw ?? title}`,
        title: title.replace(/\s*\[eztv\]\s*/gi, "").trim(),
        sizeBytes: parseSize(cells[3]),
        seeders: toNumber(cells[5]),
        leechers: 0,
        publishedAt: fuzzyAgoToIso(cells[4]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl,
        infoHash,
        sourceUrl: sourceUrlRaw
          ? new URL(sourceUrlRaw, config.baseUrl).toString()
          : config.baseUrl,
      };
    });
}

function parseRss(
  config: IndexerConfig,
  xml: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  let parsed: { rss?: { channel?: { item?: RssItem[] } } };
  try {
    parsed = rssParser.parse(xml);
  } catch (cause) {
    throw new IndexerError("Failed to parse Cardigann RSS response.", {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  }

  return (parsed.rss?.channel?.item ?? [])
    .slice(0, limit)
    .map((item) => normalizeRssItem(config, item));
}

function parseJson<T>(config: IndexerConfig, body: string): T {
  try {
    return JSON.parse(body) as T;
  } catch (cause) {
    throw new IndexerError("Failed to parse Cardigann JSON response.", {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  }
}

function normalizeRssItem(config: IndexerConfig, item: RssItem): TorrentSearchResult {
  const magnetUrl = pickMagnet(
    textOf(item.link),
    item.enclosure?.["@_url"],
    textOf(item.guid),
  );
  const infoHash =
    normalizeHash(textOf(item.infoHash)) ?? infoHashFromMagnet(magnetUrl);
  const seeders = toNumber(item.seeders);
  const peers = toNumber(item.peers);

  return {
    id: `${config.id}:${infoHash ?? textOf(item.guid) ?? textOf(item.link) ?? textOf(item.title) ?? ""}`,
    title: textOf(item.title) ?? "Untitled",
    sizeBytes: parseSize(textOf(item.size)) ?? toNumber(item.enclosure?.["@_length"]),
    seeders,
    leechers: toNumber(item.leechers) ?? deriveLeechers(seeders, peers),
    publishedAt: toIsoDate(item.pubDate),
    indexerId: config.id,
    indexerName: config.name,
    magnetUrl,
    infoHash,
    sourceUrl: pickSourceUrl(item.comments, item.link),
  };
}

function normalizeYts(
  config: IndexerConfig,
  payload: YtsResponse,
  limit: number | undefined,
): TorrentSearchResult[] {
  const results: TorrentSearchResult[] = [];
  for (const movie of payload.data?.movies ?? []) {
    for (const torrent of movie.torrents ?? []) {
      const infoHash = normalizeHash(torrent.hash);
      results.push({
        id: `${config.id}:${infoHash ?? torrent.url ?? movie.url ?? movie.title}`,
        title: [
          movie.title_long ?? movie.title ?? "Untitled",
          torrent.quality,
          torrent.type,
        ]
          .filter(Boolean)
          .join(" "),
        sizeBytes: torrent.size_bytes,
        seeders: torrent.seeds,
        leechers: torrent.peers,
        publishedAt: torrent.date_uploaded_unix
          ? new Date(torrent.date_uploaded_unix * 1000).toISOString()
          : undefined,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: infoHash
          ? magnetFromInfoHash(infoHash, movie.title_long)
          : undefined,
        infoHash,
        sourceUrl: torrent.url ?? movie.url,
      });
    }
  }
  return results.slice(0, limit);
}

function normalizePirateBay(
  config: IndexerConfig,
  payload: PirateBayItem[],
  limit: number | undefined,
): TorrentSearchResult[] {
  return payload
    .filter((item) => item.id !== "0")
    .slice(0, limit)
    .map((item) => {
      const infoHash = normalizeHash(item.info_hash);
      return {
        id: `${config.id}:${infoHash ?? item.id ?? item.name ?? ""}`,
        title: item.name ?? "Untitled",
        sizeBytes: toNumber(item.size),
        seeders: toNumber(item.seeders),
        leechers: toNumber(item.leechers),
        publishedAt: unixToIso(item.added),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: infoHash ? magnetFromInfoHash(infoHash, item.name) : undefined,
        infoHash,
        sourceUrl: item.id
          ? new URL(`/description.php?id=${item.id}`, config.baseUrl).toString()
          : config.baseUrl,
      };
    });
}

function normalizeKnaben(
  config: IndexerConfig,
  payload: KnabenResponse,
  limit: number | undefined,
): TorrentSearchResult[] {
  return (payload.hits ?? [])
    .slice(0, limit)
    .map((hit) => {
      const infoHash = normalizeHash(hit.hash) ?? infoHashFromMagnet(hit.magnetUrl);
      return {
        id: `${config.id}:${infoHash ?? hit.magnetUrl ?? hit.title ?? ""}`,
        title: hit.title ?? "Untitled",
        sizeBytes: hit.bytes,
        seeders: hit.seeders,
        leechers: deriveLeechers(hit.seeders, hit.peers),
        publishedAt: toIsoDate(hit.date),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl:
          hit.magnetUrl ??
          (infoHash ? magnetFromInfoHash(infoHash, hit.title) : undefined),
        infoHash,
        sourceUrl: hit.details,
      };
    })
    .filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeSolidTorrents(
  config: IndexerConfig,
  payload: SolidTorrentsResponse,
  limit: number | undefined,
): TorrentSearchResult[] {
  return (payload.results ?? [])
    .slice(0, limit)
    .map((item) => {
      const infoHash = normalizeHash(item.infohash);
      return {
        id: `${config.id}:${infoHash ?? item.id ?? item.title ?? ""}`,
        title: item.title ?? "Untitled",
        sizeBytes: item.size,
        seeders: item.seeders,
        leechers: item.leechers,
        publishedAt: toIsoDate(item.updatedAt),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: infoHash ? magnetFromInfoHash(infoHash, item.title) : undefined,
        infoHash,
        sourceUrl: item.id
          ? new URL(`/view/${item.id}`, config.baseUrl).toString()
          : config.baseUrl,
      };
    })
    .filter((result) => result.infoHash);
}

function normalizeTheRarbg(
  config: IndexerConfig,
  payload: TheRarbgResponse,
  limit: number | undefined,
): TorrentSearchResult[] {
  return (payload.results ?? [])
    .slice(0, limit)
    .map((item) => {
      const infoHash = normalizeHash(item.h);
      return {
        id: `${config.id}:${infoHash ?? item.pk ?? item.n ?? ""}`,
        title: item.n ?? "Untitled",
        sizeBytes: item.s,
        seeders: item.se,
        leechers: item.le,
        publishedAt: item.a ? new Date(item.a * 1000).toISOString() : undefined,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: infoHash ? magnetFromInfoHash(infoHash, item.n) : undefined,
        infoHash,
        sourceUrl: item.pk
          ? new URL(`/post-detail/${item.pk}/`, config.baseUrl).toString()
          : config.baseUrl,
      };
    })
    .filter((result) => result.infoHash);
}

/**
 * LimeTorrents lists results in a `table2` whose rows link to detail pages of
 * the form `…-torrent-<id>.html`. The magnet lives on the detail page (like
 * 1337x), so we follow each row to resolve it. Size/seeders/leechers come from
 * the listing row's trailing cells.
 */
async function normalizeLimeTorrents(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const rows = [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /href=["'][^"']*-torrent-\d+\.html["']/i.test(row))
    .slice(0, limit ?? 20);

  const results = await Promise.all(
    rows.map(async (row) => {
      const link = row.match(
        /<a\b[^>]*href=["']([^"']*-torrent-\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      const detailPath = htmlDecode(link?.[1]);
      const title = cleanText(link?.[2]) ?? "Untitled";
      const detailUrl = detailPath
        ? new URL(detailPath, config.baseUrl).toString()
        : undefined;
      const { magnet, infoHash } = detailUrl
        ? await resolveMagnetFromDetail(config, detailUrl, title)
        : { magnet: undefined, infoHash: undefined };
      const cells = tableCells(row);

      return {
        id: `${config.id}:${infoHash ?? detailPath ?? title}`,
        title,
        // cells: [name, added, size, seed, leech, health]
        sizeBytes: parseSize(cells[2]),
        seeders: toNumber(cells[3]),
        leechers: toNumber(cells[4]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: magnet,
        infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );

  return results.filter((result) => result.magnetUrl || result.infoHash);
}

/**
 * Torrent Downloads lists each result in a `grey_bar3` row linking to
 * `/torrent/<id>/<slug>`, with `<span>` cells for seeders, leechers and size.
 * The magnet (or a labelled infohash) lives on the detail page, so we resolve
 * it per result. The `#disqus_thread` comment anchor reuses the same path — we
 * exclude the fragment from the link match so it can't masquerade as a result.
 */
async function normalizeTorrentDownloads(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const seen = new Set<string>();
  const rows: Array<{ path: string; title: string; cells: string[] }> = [];
  for (const block of splitByMarker(html, /class=["'][^"']*grey_bar3[^"']*["']/gi)) {
    const link = block.match(
      /<a\b[^>]*href=["'](\/torrent\/\d+\/[^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const path = link ? htmlDecode(link[1]) : undefined;
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    // Non-empty data spans, in order: [seeders, leechers, size]. The leading
    // `health` and trailing `check_box` spans hold only images, so drop blanks.
    const cells = [...block.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => cleanText(match[1]))
      .filter((text): text is string => Boolean(text));
    rows.push({ path, title: cleanText(link?.[2]) ?? "Untitled", cells });
    if (rows.length >= (limit ?? 20)) {
      break;
    }
  }

  const results = await Promise.all(
    rows.map(async ({ path, title, cells }) => {
      const detailUrl = new URL(path, config.baseUrl).toString();
      const { magnet, infoHash } = await resolveMagnetFromDetail(
        config,
        detailUrl,
        title,
      );
      return {
        id: `${config.id}:${infoHash ?? path}`,
        title,
        sizeBytes: parseSize(cells[2]),
        seeders: toNumber(cells[0]),
        leechers: toNumber(cells[1]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: magnet,
        infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );

  return results.filter((result) => result.magnetUrl || result.infoHash);
}

/**
 * TorrentDownload (`torrentdownload.info`) uses `table2` rows with `tt-name`
 * detail links shaped like `/<infohash>/<slug>`. The detail page carries a
 * magnet, but the listing URL itself gives us enough to return a usable magnet
 * without fetching every detail page.
 */
async function normalizeTorrentDownload(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const seen = new Set<string>();
  const rows: Array<{ path: string; title: string; cells: string[] }> = [];
  for (const row of [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(
    (match) => match[0],
  )) {
    if (
      !/class=["'][^"']*tt-name[^"']*["']/i.test(row) ||
      !/class=["'][^"']*smallish[^"']*["']/i.test(row)
    ) {
      continue;
    }
    const link = row.match(
      /<div\b[^>]*class=["'][^"']*tt-name[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["'](\/[^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    const path = htmlDecode(link?.[1]);
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    rows.push({
      path,
      title: cleanText(link?.[2]) ?? "Untitled",
      cells: tableCells(row),
    });
    if (rows.length >= (limit ?? 20)) {
      break;
    }
  }

  const results = await Promise.all(
    rows.map(async ({ path, title, cells }) => {
      const detailUrl = new URL(path, config.baseUrl).toString();
      const listedInfoHash = infoHashFromPath(path);
      const resolved = listedInfoHash
        ? {
            magnet: magnetFromInfoHash(listedInfoHash, title),
            infoHash: listedInfoHash,
          }
        : await resolveMagnetFromDetail(config, detailUrl, title);

      return {
        id: `${config.id}:${resolved.infoHash ?? path}`,
        title,
        sizeBytes: parseSize(cells[2]),
        seeders: parseCount(cells[3]),
        leechers: parseCount(cells[4]),
        publishedAt: fuzzyAgoToIso(cells[1]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );

  return results.filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeAniSource(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<div\b[^>]*class=["'][^"']*item[^"']*["'][\s\S]*?(?=<div\b[^>]*class=["'][^"']*item|$)/gi)]
    .map((match) => match[0])
    .slice(0, limit ?? 20)
    .map((block) => {
      const link = block.match(
        /<a\b[^>]*href=["']([^"']*\/showprofile\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      const href = htmlDecode(link?.[1]);
      const title = cleanText(link?.[2]) ?? "Untitled";
      const infoHash = normalizeHash(href?.match(/([a-f0-9]{40})/i)?.[1]);
      const meta = cleanText(block);
      return {
        id: `${config.id}:${infoHash ?? href ?? title}`,
        title: title.replace(/^(\[[^\]]+\])\s+(.+)$/, "$2 $1"),
        sizeBytes: parseSize(meta?.match(/Size:\s*([^|]+)/i)?.[1]?.replace(/b\b/i, "B")),
        publishedAt: toIsoDate(
          meta?.match(/Date:\s*(.+?)\s+Central/i)?.[1]?.replace(" at ", " "),
        ),
        seeders: 1,
        leechers: 1,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: infoHash ? magnetFromInfoHash(infoHash, title) : undefined,
        infoHash,
        sourceUrl: href ? new URL(href, config.baseUrl).toString() : config.baseUrl,
      };
    })
    .filter((result) => result.infoHash);
}

function normalizeDaMagnet(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /<a\b/i.test(row))
    .slice(0, limit ?? 20)
    .map((row) => {
      const link = row.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const href = htmlDecode(link?.[1]);
      const title = cleanText(link?.[2]) ?? "Untitled";
      const magnetUrl = pickMagnet(htmlDecode(row), href);
      const infoHash =
        infoHashFromMagnet(magnetUrl) ?? normalizeHash(href?.match(/([a-f0-9]{40})/i)?.[1]);
      return {
        id: `${config.id}:${infoHash ?? href ?? title}`,
        title,
        sizeBytes: parseSize(cellByIdPrefix(row, "size")),
        seeders: 1,
        leechers: 1,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: magnetUrl ?? (infoHash ? magnetFromInfoHash(infoHash, title) : undefined),
        infoHash,
        sourceUrl: href?.startsWith("http") ? href : config.baseUrl,
      };
    })
    .filter((result) => result.magnetUrl || result.infoHash);
}

async function normalizeEBookBay(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const blocks = splitByMarker(html, /<div\b[^>]*class=["'][^"']*poststuff[^"']*["']/gi)
    .filter((block) => /class=["'][^"']*download[^"']*["']|class=["'][^"']*detail[^"']*["']/i.test(block))
    .slice(0, limit ?? 20);

  const results = await Promise.all(
    blocks.map(async (block) => {
      const titleLink = block.match(
        /<div\b[^>]*class=["'][^"']*postname[^"']*["'][\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      );
      const download = block.match(
        /<a\b[^>]*class=["'][^"']*(?:download|detail)[^"']*["'][^>]*href=["']([^"']+)["']/i,
      );
      const title = cleanText(titleLink?.[2]) ?? "Untitled";
      const detailUrl = absoluteUrl(htmlDecode(titleLink?.[1]), config.baseUrl);
      const downloadUrl = absoluteUrl(htmlDecode(download?.[1]), config.baseUrl) ?? detailUrl;
      const resolved = downloadUrl
        ? await resolveMagnetFromDownload(config, downloadUrl, title)
        : { magnet: undefined, infoHash: undefined };
      return {
        id: `${config.id}:${resolved.infoHash ?? downloadUrl ?? title}`,
        title,
        sizeBytes: parseSize(cleanText(block)?.match(/File Size:\s*([^|]+?)(?:\s+Seeds:|$)/i)?.[1]),
        seeders: toNumber(cleanText(block)?.match(/Seeds:\s*(\d+)/i)?.[1]),
        leechers: toNumber(cleanText(block)?.match(/Peers:\s*(\d+)/i)?.[1]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: detailUrl ?? downloadUrl,
      };
    }),
  );

  return results.filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeEHentai(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[^>]*class=["']gtr[^"']*["'][\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .slice(0, limit ?? 20)
    .map((row) => {
      const link = row.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const detailUrl = absoluteUrl(htmlDecode(link?.[1]), config.baseUrl);
      const title =
        cleanText(
          row.match(/<div\b[^>]*class=["']glink["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
        ) ??
        cleanText(link?.[2]) ??
        "Untitled";
      const cells = tableCells(row);

      return {
        id: `${config.id}:${detailUrl ?? title}`,
        title,
        sizeBytes: parseSize(cells.find((cell) => /[KMGT]i?B/i.test(cell))),
        seeders: 1,
        leechers: 0,
        indexerId: config.id,
        indexerName: config.name,
        sourceUrl: detailUrl,
      };
    })
    .filter((result) => result.sourceUrl);
}

async function normalizeGamesTorrents(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const rows = [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /<table\b|<th\b/i.test(row) === false && /<a\b[^>]*href=/i.test(row))
    .slice(0, limit ?? 10);

  const results = await Promise.all(
    rows.map(async (row) => {
      const link = row.match(/<td\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const detailUrl = absoluteUrl(htmlDecode(link?.[1]), config.baseUrl);
      const title = cleanText(link?.[2]) ?? "Untitled";
      const cells = tableCells(row);
      const resolved = detailUrl
        ? await resolveMagnetFromDetail(config, detailUrl, title)
        : { magnet: undefined, infoHash: undefined };
      return {
        id: `${config.id}:${resolved.infoHash ?? detailUrl ?? title}`,
        title,
        publishedAt: parseDmyDate(cells[1], "+01:00"),
        sizeBytes: parseSize(cells[2]?.replace(/s$/i, "")),
        seeders: 1,
        leechers: 1,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );

  return results.filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeKickassTo(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /magnet:\?xt=urn:btih:/i.test(row))
    .slice(0, limit ?? 20)
    .map((row) => {
      const link = row.match(/<a\b[^>]*class=["'][^"']*cellMainLink[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const magnetUrl = pickMagnet(htmlDecode(row));
      const infoHash = infoHashFromMagnet(magnetUrl);
      const cells = tableCells(row);
      return {
        id: `${config.id}:${infoHash ?? htmlDecode(link?.[1]) ?? cleanText(link?.[2]) ?? ""}`,
        title: cleanText(link?.[2]) ?? "Untitled",
        sizeBytes: parseSize(cells[1]),
        publishedAt: fuzzyAgoToIso(cells[2]),
        seeders: parseCount(cells[4]),
        leechers: parseCount(cells[5]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl,
        infoHash,
        sourceUrl: absoluteUrl(htmlDecode(link?.[1]), config.baseUrl),
      };
    })
    .filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeKickassWs(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[^>]*id=["'][^"']+["'][\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /data-download|magnet:\?xt=urn:btih:/i.test(row))
    .slice(0, limit ?? 20)
    .map((row) => {
      const link = row.match(/<a\b[^>]*class=["']cellMainLink["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const download = row.match(/<a\b[^>]*(?:data-download|href)=["']([^"']+)["'][^>]*>/i);
      const rawDownload = htmlDecode(download?.[1]);
      const magnetUrl = pickMagnet(htmlDecode(row), queryParam(rawDownload, "url"), rawDownload);
      const infoHash = infoHashFromMagnet(magnetUrl);
      const cells = tableCells(row);
      return {
        id: `${config.id}:${infoHash ?? htmlDecode(link?.[1]) ?? cleanText(link?.[2]) ?? ""}`,
        title: cleanText(link?.[2]) ?? "Untitled",
        sizeBytes: parseSize(cells[1]),
        publishedAt: fuzzyAgoToIso(cells[2]),
        seeders: parseCount(cells[3]),
        leechers: parseCount(cells[4]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl,
        infoHash,
        sourceUrl: absoluteUrl(htmlDecode(link?.[1]), config.baseUrl),
      };
    })
    .filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeLinuxTracker(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .filter((row) => /index\.php\?page=torrent-details&amp;id=|index\.php\?page=torrent-details&id=/i.test(row))
    .slice(0, limit ?? 20)
    .map((row) => {
      const link = row.match(
        /<a\b[^>]*href=["']([^"']*index\.php\?page=torrent-details(?:&amp;|&)id=[^"']+)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/a>/i,
      );
      const href = htmlDecode(link?.[1]);
      const title = cleanText(link?.[2]) ?? cleanText(link?.[3]) ?? "Untitled";
      const infoHash = normalizeHash(queryParam(href, "id"));
      const cells = tableCells(row);
      const stats = cells.join(" ");
      return {
        id: `${config.id}:${infoHash ?? href ?? title}`,
        title,
        sizeBytes: parseSize(stats.match(/Size:\s*([^ ]+\s*[KMGT]?i?B?)/i)?.[1]),
        seeders: parseCount(stats.match(/Seeds:\s*(\d+)/i)?.[1]),
        leechers: parseCount(stats.match(/Leechers:\s*(\d+)/i)?.[1]),
        publishedAt: parseDmyDate(stats.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1], "-07:00"),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: infoHash ? magnetFromInfoHash(infoHash, title) : undefined,
        infoHash,
        sourceUrl: absoluteUrl(href, config.baseUrl),
      };
    })
    .filter((result) => result.infoHash);
}

async function normalizeMacTorrentsDownload(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const articles = [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)]
    .map((match) => match[0])
    .slice(0, limit ?? 10);
  const results = await Promise.all(
    articles.map(async (article) => {
      const link = article.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*>/i);
      const detailUrl = absoluteUrl(htmlDecode(link?.[1]), config.baseUrl);
      const title =
        cleanText(link?.[2]) ??
        cleanText(article.match(/<h2\b[\s\S]*?<\/h2>/i)?.[0]) ??
        "Untitled";
      const resolved = detailUrl
        ? await resolveMagnetFromDetail(config, detailUrl, title)
        : { magnet: undefined, infoHash: undefined };
      return {
        id: `${config.id}:${resolved.infoHash ?? detailUrl ?? title}`,
        title,
        publishedAt: toIsoDate(article.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]),
        sizeBytes: 512 * 1024 * 1024,
        seeders: 1,
        leechers: 1,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );
  return results.filter((result) => result.magnetUrl || result.infoHash);
}

async function normalizeNipponsei(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const rows = [...html.matchAll(/<tr\b[^>]*class=["'][^"']*(?:odd|even)[^"']*["'][\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .slice(0, limit ?? 20);
  const results = await Promise.all(
    rows.map(async (row) => {
      const link = row.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const title = (cleanText(link?.[2]) ?? "Untitled").replace(/^\[Nipponsei\]\s*/i, "");
      const downloadUrl = absoluteUrl(htmlDecode(link?.[1]), config.baseUrl);
      const resolved = downloadUrl
        ? await resolveMagnetFromDownload(config, downloadUrl, title)
        : { magnet: undefined, infoHash: undefined };
      const cells = tableCells(row);
      return {
        id: `${config.id}:${resolved.infoHash ?? downloadUrl ?? title}`,
        title,
        sizeBytes: parseSize(cells.find((cell) => /[KMGT]i?B/i.test(cell))),
        seeders: parseCount(cells[1]),
        leechers: parseCount(cells[2]),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: config.baseUrl,
      };
    }),
  );
  return results.filter((result) => result.magnetUrl || result.infoHash);
}

async function normalizePcTorrent(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const blocks = splitByMarker(html, /<div\b[^>]*class=["'][^"']*dshort[^"']*["']/gi)
    .filter((block) => /class=["'][^"']*d3-raz[^"']*["']/i.test(block))
    .slice(0, limit ?? 10);
  const results = await Promise.all(
    blocks.map(async (block) => {
      const link = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
      const title = cleanText(block.match(/<div\b[^>]*class=["'][^"']*d3-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) ??
        cleanText(block.match(/<img\b[^>]*alt=["']([^"']+)["']/i)?.[1]) ??
        "Untitled";
      const detailUrl = absoluteUrl(htmlDecode(link?.[1]), config.baseUrl);
      const resolved = detailUrl
        ? await resolveMagnetFromDetail(config, detailUrl, title)
        : { magnet: undefined, infoHash: undefined };
      return {
        id: `${config.id}:${resolved.infoHash ?? detailUrl ?? title}`,
        title,
        sizeBytes: parseSize(cleanText(block.match(/<div\b[^>]*class=["'][^"']*d3-raz[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])),
        seeders: 1,
        leechers: 1,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: detailUrl,
      };
    }),
  );
  return results.filter((result) => result.magnetUrl || result.infoHash);
}

function normalizeTorrentBy(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): TorrentSearchResult[] {
  return [...html.matchAll(/<tr\b[^>]*class=["'][^"']*ttable_col[^"']*["'][\s\S]*?<\/tr>/gi)]
    .map((match) => match[0])
    .slice(0, limit ?? 20)
    .map((row) => {
      const link = row.match(/<td\b[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const magnetUrl = pickMagnet(htmlDecode(row));
      const infoHash = infoHashFromMagnet(magnetUrl);
      const cells = tableCells(row);
      return {
        id: `${config.id}:${infoHash ?? htmlDecode(link?.[1]) ?? cleanText(link?.[2]) ?? ""}`,
        title: cleanText(link?.[2]) ?? "Untitled",
        sizeBytes: parseSize(cells[4]),
        seeders: parseCount(cleanText(row.match(/<font\b[^>]*color=["']green["'][^>]*>([\s\S]*?)<\/font>/i)?.[1])),
        leechers: parseCount(cleanText(row.match(/<font\b[^>]*color=["']red["'][^>]*>([\s\S]*?)<\/font>/i)?.[1])),
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl,
        infoHash,
        sourceUrl: absoluteUrl(htmlDecode(link?.[1]), config.baseUrl),
      };
    })
    .filter((result) => result.magnetUrl || result.infoHash);
}

async function normalizeTorrentCore(
  config: IndexerConfig,
  html: string,
  limit: number | undefined,
): Promise<TorrentSearchResult[]> {
  const blocks = splitByMarker(html, /<font\b[^>]*color=["'](?:purple|orange|gray|white)["'][^>]*>/gi)
    .filter((block) => /<a\b/i.test(block))
    .slice(0, limit ?? 20);
  const results = await Promise.all(
    blocks.map(async (block) => {
      const link = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const href = htmlDecode(link?.[1]);
      const title = cleanText(link?.[2]) ?? "Untitled";
      const magnet = pickMagnet(htmlDecode(block), href);
      const resolved = magnet
        ? { magnet, infoHash: infoHashFromMagnet(magnet) }
        : href
          ? await resolveMagnetFromDownload(config, new URL(href, config.baseUrl).toString(), title)
          : { magnet: undefined, infoHash: undefined };
      const text = cleanText(block);
      return {
        id: `${config.id}:${resolved.infoHash ?? href ?? title}`,
        title,
        sizeBytes: parseSize(text?.match(/Size:\s*([^/]+)/i)?.[1]),
        publishedAt: toIsoDate(text?.match(/\[\s*([^\]]+)\s*\]/)?.[1]),
        seeders: 1,
        leechers: 1,
        indexerId: config.id,
        indexerName: config.name,
        magnetUrl: resolved.magnet,
        infoHash: resolved.infoHash,
        sourceUrl: href ? new URL(href, config.baseUrl).toString() : config.baseUrl,
      };
    }),
  );
  return results.filter((result) => result.magnetUrl || result.infoHash);
}

/** Pulls every magnet URI out of an HTML blob, decoding entity-escaped `&`. */
function extractMagnets(html: string): string[] {
  return [...html.matchAll(/magnet:\?xt=urn:btih:[^\s"'<>]+/gi)].map(
    (match) => htmlDecode(match[0])!,
  );
}

/** Finds a labelled 40-hex infohash (e.g. "Infohash: …") in a detail page. */
function infoHashFromText(html: string): string | undefined {
  const match = html.match(/info\s*-?\s*hash[^a-f0-9]{0,24}([a-f0-9]{40})/i);
  return normalizeHash(match?.[1]);
}

/**
 * Fetches a result's detail page and resolves its magnet — preferring an inline
 * magnet link, then a labelled infohash (rebuilt into a magnet). Swallows fetch
 * errors so one dead detail page doesn't fail the whole search.
 */
async function resolveMagnetFromDetail(
  config: IndexerConfig,
  detailUrl: string,
  title: string | undefined,
): Promise<{ magnet: string | undefined; infoHash: string | undefined }> {
  const html = await fetchIndexerText(config, detailUrl).catch(() => "");
  const magnet = pickMagnet(...extractMagnets(html));
  const infoHash = infoHashFromMagnet(magnet) ?? infoHashFromText(html);
  if (magnet || infoHash) {
    return {
      magnet: magnet ?? (infoHash ? magnetFromInfoHash(infoHash, title) : undefined),
      infoHash,
    };
  }

  const torrentUrl = firstTorrentDownloadUrl(html, detailUrl);
  if (torrentUrl) {
    return resolveMagnetFromDownload(config, torrentUrl, title);
  }

  return {
    magnet: magnet ?? (infoHash ? magnetFromInfoHash(infoHash, title) : undefined),
    infoHash,
  };
}

async function resolveMagnetFromDownload(
  config: IndexerConfig,
  downloadUrl: string,
  title: string | undefined,
): Promise<{ magnet: string | undefined; infoHash: string | undefined }> {
  const magnet = pickMagnet(downloadUrl);
  const infoHash =
    infoHashFromMagnet(magnet) ??
    normalizeHash(downloadUrl.match(/([a-f0-9]{40})/i)?.[1]);
  if (magnet || infoHash) {
    return {
      magnet: magnet ?? (infoHash ? magnetFromInfoHash(infoHash, title) : undefined),
      infoHash,
    };
  }

  try {
    const bytes = await fetchIndexerBytes(config, downloadUrl, { timeoutMs: 20_000 });
    const torrentInfoHash = infoHashFromTorrentBytes(bytes);
    return {
      magnet: torrentInfoHash ? magnetFromInfoHash(torrentInfoHash, title) : undefined,
      infoHash: torrentInfoHash,
    };
  } catch {
    return { magnet: undefined, infoHash: undefined };
  }
}

function firstTorrentDownloadUrl(html: string, baseUrl: string): string | undefined {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => htmlDecode(match[1]))
    .filter((href): href is string => Boolean(href))
    .filter((href) => {
      const text = href.toLowerCase();
      return (
        text.startsWith("magnet:") ||
        text.includes(".torrent") ||
        text.includes("download.php") ||
        text.includes("/download/")
      );
    });

  for (const href of links) {
    if (href.startsWith("magnet:")) {
      return href;
    }
    const url = absoluteUrl(href.trim(), baseUrl);
    if (url) {
      return url;
    }
  }
  return undefined;
}

function presetKeyOf(config: IndexerConfig): string | undefined {
  const settings = config.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return undefined;
  }
  return typeof settings.presetKey === "string" ? settings.presetKey : undefined;
}

function firstCategory(
  params: TorrentSearchParams,
  config: IndexerConfig,
): string | undefined {
  return (params.categories?.length ? params.categories : config.categories)?.[0];
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.length > 0 ? value : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object" && "#text" in value) {
    return textOf((value as { "#text": unknown })["#text"]);
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  const text = textOf(value);
  if (text === undefined) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoDate(value: unknown): string | undefined {
  const text = textOf(value);
  if (!text) {
    return undefined;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function unixToIso(value: unknown): string | undefined {
  const parsed = toNumber(value);
  return parsed === undefined ? undefined : new Date(parsed * 1000).toISOString();
}

function parseSize(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.trim().match(/^([\d.]+)\s*([KMGT]?i?B)?$/i);
  if (!match) {
    return toNumber(value);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  const multiplier = unit.startsWith("T")
    ? 1024 ** 4
    : unit.startsWith("G")
      ? 1024 ** 3
      : unit.startsWith("M")
        ? 1024 ** 2
        : unit.startsWith("K")
          ? 1024
          : 1;
  return Number.isFinite(amount) ? Math.round(amount * multiplier) : undefined;
}

function parseCount(value: string | undefined): number | undefined {
  return toNumber(value?.replace(/,/g, ""));
}

function deriveLeechers(
  seeders: number | undefined,
  peers: number | undefined,
): number | undefined {
  if (seeders === undefined || peers === undefined) {
    return undefined;
  }
  return Math.max(peers - seeders, 0);
}

function pickMagnet(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((value) => value?.startsWith("magnet:"));
}

function pickSourceUrl(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    const text = textOf(candidate);
    if (text && /^https?:\/\//.test(text)) {
      return text;
    }
  }
  return undefined;
}

/** Splits HTML into one block per `marker` match (each block = one listing row). */
function splitByMarker(html: string, marker: RegExp): string[] {
  const starts = [...html.matchAll(marker)].map((match) => match.index ?? 0);
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? html.length));
}

function tableCells(row: string): string[] {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (match) => cleanText(match[1]) ?? "",
  );
}

function cellByClass(row: string, classPrefix: string): string | undefined {
  const escaped = classPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = row.match(
    new RegExp(
      `<td\\b[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`,
      "i",
    ),
  );
  return cleanText(match?.[1]);
}

function cellByIdPrefix(row: string, idPrefix: string): string | undefined {
  const escaped = idPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = row.match(
    new RegExp(`<[^>]+id=["']${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"),
  );
  return cleanText(match?.[1]);
}

function cleanText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const text = htmlDecode(value)!
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length ? text : undefined;
}

function htmlDecode(value: string | undefined): string | undefined {
  return value
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/gi, " ");
}

function infoHashFromPath(path: string): string | undefined {
  return normalizeHash(path.match(/\/([a-f0-9]{40})(?:\/|$)/i)?.[1]);
}

function absoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith("magnet:")) {
    return value;
  }
  try {
    return new URL(value.trim(), baseUrl).toString();
  } catch {
    return undefined;
  }
}

function queryParam(value: string | undefined, key: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const normalized = value.startsWith("http")
      ? value.replace(/&amp;/g, "&")
      : `https://example.invalid/${value.startsWith("?") ? value : `?${value}`}`;
    return new URL(normalized).searchParams.get(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function parseDmyDate(value: string | undefined, offset: string): string | undefined {
  const match = value?.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!match) {
    return undefined;
  }
  return toIsoDate(`${match[3]}-${match[2]}-${match[1]}T00:00:00${offset}`);
}

function infoHashFromTorrentBytes(bytes: Uint8Array): string | undefined {
  const slice = findTorrentInfoSlice(bytes);
  if (!slice) {
    return undefined;
  }
  return createHash("sha1").update(slice).digest("hex");
}

function findTorrentInfoSlice(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes[0] !== 0x64) {
    return undefined;
  }

  let pos = 1;
  while (pos < bytes.length && bytes[pos] !== 0x65) {
    const key = readBencodeString(bytes, pos);
    if (!key) {
      return undefined;
    }
    pos = key.next;
    const valueStart = pos;
    const valueEnd = skipBencodeValue(bytes, pos);
    if (valueEnd === undefined) {
      return undefined;
    }
    if (key.value === "info") {
      return bytes.slice(valueStart, valueEnd);
    }
    pos = valueEnd;
  }
  return undefined;
}

function skipBencodeValue(bytes: Uint8Array, pos: number): number | undefined {
  const token = bytes[pos];
  if (token === 0x69) {
    const end = bytes.indexOf(0x65, pos + 1);
    return end === -1 ? undefined : end + 1;
  }
  if (token === 0x6c) {
    pos += 1;
    while (pos < bytes.length && bytes[pos] !== 0x65) {
      const next = skipBencodeValue(bytes, pos);
      if (next === undefined) {
        return undefined;
      }
      pos = next;
    }
    return bytes[pos] === 0x65 ? pos + 1 : undefined;
  }
  if (token === 0x64) {
    pos += 1;
    while (pos < bytes.length && bytes[pos] !== 0x65) {
      const key = readBencodeString(bytes, pos);
      if (!key) {
        return undefined;
      }
      const next = skipBencodeValue(bytes, key.next);
      if (next === undefined) {
        return undefined;
      }
      pos = next;
    }
    return bytes[pos] === 0x65 ? pos + 1 : undefined;
  }
  return readBencodeString(bytes, pos)?.next;
}

function readBencodeString(
  bytes: Uint8Array,
  pos: number,
): { value: string; next: number } | undefined {
  let colon = pos;
  while (colon < bytes.length && bytes[colon] !== 0x3a) {
    if (bytes[colon] < 0x30 || bytes[colon] > 0x39) {
      return undefined;
    }
    colon += 1;
  }
  if (colon >= bytes.length) {
    return undefined;
  }
  const length = Number(Buffer.from(bytes.slice(pos, colon)).toString("ascii"));
  if (!Number.isFinite(length) || length < 0) {
    return undefined;
  }
  const start = colon + 1;
  const end = start + length;
  if (end > bytes.length) {
    return undefined;
  }
  return { value: Buffer.from(bytes.slice(start, end)).toString("utf8"), next: end };
}

function slugifySearch(query: string): string {
  return query.trim().replace(/&/g, "").replace(/-/g, "").replace(/\s+/g, "-");
}

function fuzzyAgoToIso(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const match = value.match(/(\d+)\s*(min|minute|hour|day|week|month|year)s?/i);
  if (!match) {
    return toIsoDate(value);
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit?.startsWith("year")
    ? 365 * 24 * 60 * 60 * 1000
    : unit?.startsWith("month")
      ? 30 * 24 * 60 * 60 * 1000
      : unit?.startsWith("week")
        ? 7 * 24 * 60 * 60 * 1000
        : unit?.startsWith("day")
          ? 24 * 60 * 60 * 1000
          : unit?.startsWith("hour")
            ? 60 * 60 * 1000
            : 60 * 1000;
  return Number.isFinite(amount)
    ? new Date(Date.now() - amount * multiplier).toISOString()
    : undefined;
}
