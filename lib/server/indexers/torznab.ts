import { XMLParser } from "fast-xml-parser";

import { fetchIndexerText } from "@/lib/server/indexers/fetch";
import {
  IndexerError,
  type IndexerAdapter,
  type IndexerConfig,
  type IndexerTestOutcome,
  type IndexerType,
  type TorrentSearchParams,
  type TorrentSearchResult,
} from "@/lib/server/indexers/types";

// Torznab results carry their torrent metadata as repeated <torznab:attr>
// elements. `removeNSPrefix` collapses `torznab:attr` -> `attr`, and `isArray`
// guarantees `item`/`attr` are always arrays so single-result feeds parse the
// same way as many-result feeds.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseAttributeValue: false,
  isArray: (name) => name === "item" || name === "attr",
});

type TorznabAttr = { "@_name"?: string; "@_value"?: string };

type TorznabItem = {
  title?: unknown;
  guid?: unknown;
  link?: unknown;
  comments?: unknown;
  pubDate?: unknown;
  size?: unknown;
  enclosure?: { "@_url"?: string; "@_length"?: string; "@_type"?: string };
  attr?: TorznabAttr[];
};

export class TorznabIndexerAdapter implements IndexerAdapter {
  readonly type: IndexerType = "torznab";

  async search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]> {
    const url = this.buildSearchUrl(config, params);
    const xml = await fetchIndexerText(config, url.toString(), {
      signal: params.signal,
    });

    let parsed: { rss?: { channel?: { item?: TorznabItem[]; error?: unknown } } };
    try {
      parsed = parser.parse(xml);
    } catch (cause) {
      throw new IndexerError("Failed to parse Torznab response.", {
        indexerId: config.id,
        indexerName: config.name,
        cause,
      });
    }

    const channel = parsed.rss?.channel;

    // Torznab signals errors as <error code=.. description=../> in the channel.
    if (channel && "error" in channel && channel.error) {
      const description =
        textOf((channel.error as { "@_description"?: unknown })["@_description"]) ??
        "Torznab indexer returned an error.";
      throw new IndexerError(description, {
        indexerId: config.id,
        indexerName: config.name,
      });
    }

    const items = channel?.item ?? [];
    return items.map((item) => this.normalizeItem(config, item));
  }

  /**
   * Probes the Torznab capabilities endpoint (`t=caps`). A well-formed `<caps>`
   * document confirms the base URL is reachable and the API key (if any) is
   * accepted; a `<error>` element or unexpected body fails the test.
   */
  async test(config: IndexerConfig): Promise<IndexerTestOutcome> {
    const url = new URL(config.baseUrl);
    url.searchParams.set("t", "caps");
    if (config.apiKey) {
      url.searchParams.set("apikey", config.apiKey);
    }

    const xml = await fetchIndexerText(config, url.toString());

    let parsed: { caps?: { error?: unknown }; error?: unknown };
    try {
      parsed = parser.parse(xml);
    } catch (cause) {
      throw new IndexerError("Indexer did not return a valid Torznab response.", {
        indexerId: config.id,
        indexerName: config.name,
        cause,
      });
    }

    const error = parsed.error ?? parsed.caps?.error;
    if (error) {
      const description =
        textOf((error as { "@_description"?: unknown })["@_description"]) ??
        "Torznab indexer rejected the request.";
      throw new IndexerError(description, {
        indexerId: config.id,
        indexerName: config.name,
      });
    }

    if (!parsed.caps) {
      throw new IndexerError("Indexer response did not include Torznab capabilities.", {
        indexerId: config.id,
        indexerName: config.name,
      });
    }

    return { ok: true, message: "Indexer responded to a capabilities check." };
  }

  private buildSearchUrl(config: IndexerConfig, params: TorrentSearchParams): URL {
    const url = new URL(config.baseUrl);
    url.searchParams.set("t", "search");
    url.searchParams.set("q", params.query);

    if (config.apiKey) {
      url.searchParams.set("apikey", config.apiKey);
    }

    const categories = params.categories?.length
      ? params.categories
      : config.categories;
    if (categories?.length) {
      url.searchParams.set("cat", categories.join(","));
    }

    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }

    return url;
  }

  private normalizeItem(config: IndexerConfig, item: TorznabItem): TorrentSearchResult {
    const attrs = indexAttrs(item.attr);

    const enclosureUrl = item.enclosure?.["@_url"];
    const magnetUrl = pickMagnet(
      enclosureUrl,
      attrs.get("magneturl"),
      textOf(item.link),
    );
    const infoHash =
      normalizeHash(attrs.get("infohash")) ?? infoHashFromMagnet(magnetUrl);

    const seeders = toNumber(attrs.get("seeders"));
    const leechers = deriveLeechers(seeders, attrs.get("peers"), attrs.get("leechers"));

    const sizeBytes =
      toNumber(item.size) ??
      toNumber(attrs.get("size")) ??
      toNumber(item.enclosure?.["@_length"]);

    const sourceUrl = pickSourceUrl(item.comments, item.guid, item.link);
    const guid = textOf(item.guid);

    return {
      id: `${config.id}:${infoHash ?? guid ?? sourceUrl ?? textOf(item.title) ?? ""}`,
      title: textOf(item.title) ?? "Untitled",
      sizeBytes,
      seeders,
      leechers,
      publishedAt: toIsoDate(item.pubDate),
      indexerId: config.id,
      indexerName: config.name,
      magnetUrl,
      infoHash,
      sourceUrl,
    };
  }
}

function indexAttrs(attrs: TorznabAttr[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const attr of attrs ?? []) {
    const name = attr["@_name"];
    const value = attr["@_value"];
    if (typeof name === "string" && typeof value === "string") {
      map.set(name.toLowerCase(), value);
    }
  }
  return map;
}

/** Extracts a text value from a node that may be a scalar or `{ "#text": .. }`. */
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

/** Torznab reports total `peers`; leechers = peers - seeders when not explicit. */
function deriveLeechers(
  seeders: number | undefined,
  peersRaw: string | undefined,
  leechersRaw: string | undefined,
): number | undefined {
  const explicit = toNumber(leechersRaw);
  if (explicit !== undefined) {
    return explicit;
  }
  const peers = toNumber(peersRaw);
  if (peers === undefined || seeders === undefined) {
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

function normalizeHash(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(trimmed) ? trimmed : undefined;
}

function infoHashFromMagnet(magnet: string | undefined): string | undefined {
  if (!magnet) {
    return undefined;
  }
  const match = magnet.match(/xt=urn:btih:([0-9a-zA-Z]+)/);
  return match ? normalizeHash(match[1]) : undefined;
}
