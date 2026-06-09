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

type ArchiveSearchResponse = {
  response?: {
    docs?: ArchiveDoc[];
  };
};

type ArchiveDoc = {
  identifier?: string;
  title?: string;
  item_size?: number;
  date?: string;
  publicdate?: string;
  downloads?: number;
};

export class InternetArchiveIndexerAdapter implements IndexerAdapter {
  readonly type: IndexerType = "internet_archive";

  async search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]> {
    const url = searchUrl(config, params);
    const payload = parseJson(config, await fetchIndexerText(config, url.toString()));
    const docs = payload.response?.docs ?? [];

    return docs
      .map((doc) => normalizeDoc(config, doc))
      .filter((result): result is TorrentSearchResult => Boolean(result))
      .slice(0, params.limit ?? 20);
  }

  async test(config: IndexerConfig): Promise<IndexerTestOutcome> {
    const results = await this.search(config, { query: "ubuntu", limit: 1 });
    const suffix = results.length === 1 ? " and returned a result" : "";
    return { ok: true, message: `Internet Archive responded${suffix}.` };
  }
}

function searchUrl(config: IndexerConfig, params: TorrentSearchParams): URL {
  const url = new URL("/advancedsearch.php", config.baseUrl);
  const query = params.query.trim();
  url.searchParams.set("q", query || "*:*");
  url.searchParams.set("output", "json");
  url.searchParams.set("rows", String(Math.min(params.limit ?? 20, 50)));
  url.searchParams.set("sort[]", "downloads desc");
  url.searchParams.append("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "item_size");
  url.searchParams.append("fl[]", "date");
  url.searchParams.append("fl[]", "publicdate");
  url.searchParams.append("fl[]", "downloads");
  return url;
}

function normalizeDoc(
  config: IndexerConfig,
  doc: ArchiveDoc,
): TorrentSearchResult | null {
  if (!doc.identifier) {
    return null;
  }

  const title = doc.title?.trim() || doc.identifier;
  const sourceUrl = new URL(
    `/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(
      `${doc.identifier}_archive.torrent`,
    )}`,
    config.baseUrl,
  ).toString();

  return {
    id: `${config.id}:${doc.identifier}`,
    title,
    sizeBytes: typeof doc.item_size === "number" ? doc.item_size : undefined,
    seeders: typeof doc.downloads === "number" ? doc.downloads : undefined,
    publishedAt: toIsoDate(doc.date ?? doc.publicdate),
    indexerId: config.id,
    indexerName: config.name,
    sourceUrl,
    // Archive.org items expose their files directly over HTTP, so offer a
    // no-torrent / no-debrid path resolved from the item metadata at add time.
    directSource: { kind: "internet_archive", identifier: doc.identifier },
  };
}

function parseJson(config: IndexerConfig, body: string): ArchiveSearchResponse {
  try {
    return JSON.parse(body) as ArchiveSearchResponse;
  } catch (cause) {
    throw new IndexerError("Failed to parse Internet Archive response.", {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  }
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
