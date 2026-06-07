import { gunzipSync } from "zlib";

import { fetchIndexerBytes } from "@/lib/server/indexers/fetch";
import {
  IndexerError,
  type IndexerAdapter,
  type IndexerConfig,
  type IndexerTestOutcome,
  type IndexerType,
  type TorrentSearchParams,
  type TorrentSearchResult,
} from "@/lib/server/indexers/types";

const INDEX_CACHE_TTL_MS = 30 * 60 * 1000;

let cachedIndex: { expiresAt: number; paths: string[]; lowerPaths: string[] } | undefined;

export class MinervaIndexerAdapter implements IndexerAdapter {
  readonly type: IndexerType = "minerva";

  async search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]> {
    const query = params.query.trim();
    if (query.length < 3) {
      return [];
    }

    const index = await loadIndex(config, params.signal);
    const tokenRegexes = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => new RegExp(token.split("").join("[^a-z0-9]*")));

    if (tokenRegexes.length === 0) {
      return [];
    }

    const limit = params.limit ?? 20;
    const results: TorrentSearchResult[] = [];

    for (let indexPosition = 0; indexPosition < index.paths.length; indexPosition += 1) {
      const target = index.lowerPaths[indexPosition];
      if (!tokenRegexes.every((regex) => regex.test(target))) {
        continue;
      }

      const path = index.paths[indexPosition];
      results.push(normalizePath(config, path));

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  async test(config: IndexerConfig): Promise<IndexerTestOutcome> {
    const results = await this.search(config, { query: "mario", limit: 1 });
    const suffix = results.length === 1 ? " and returned a result" : "";
    return { ok: true, message: `MiNERVA index responded${suffix}.` };
  }
}

async function loadIndex(
  config: IndexerConfig,
  signal: AbortSignal | undefined,
): Promise<{ paths: string[]; lowerPaths: string[] }> {
  const now = Date.now();
  if (cachedIndex && cachedIndex.expiresAt > now) {
    return cachedIndex;
  }

  const url = new URL("/assets/index.txt.gz", config.baseUrl).toString();
  const bytes = await fetchIndexerBytes(config, url, { signal, timeoutMs: 60_000 });

  let text: string;
  try {
    text = gunzipSync(bytes).toString("utf8");
  } catch (cause) {
    throw new IndexerError("Failed to decompress MiNERVA search index.", {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  }

  const paths = text.split("\n").filter(Boolean);
  cachedIndex = {
    expiresAt: now + INDEX_CACHE_TTL_MS,
    paths,
    lowerPaths: paths.map((path) => path.toLowerCase()),
  };
  return cachedIndex;
}

function normalizePath(config: IndexerConfig, path: string): TorrentSearchResult {
  const title = path.split("/").pop() || path;
  const sourceUrl = new URL(
    `/rom/?name=${encodeURIComponent(path)}`,
    config.baseUrl,
  ).toString();

  return {
    id: `${config.id}:${path}`,
    title,
    indexerId: config.id,
    indexerName: config.name,
    sourceUrl,
  };
}
