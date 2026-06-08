import {
  dedupeByInfoHash,
  sortBySeeders,
  type SearchResultDto,
  type SearchStreamEvent,
} from "@/lib/search";
import { loadEnabledIndexerConfigs } from "@/lib/server/indexers/config";
import { getIndexerAdapter } from "@/lib/server/indexers/registry";
import {
  IndexerError,
  type IndexerConfig,
  type TorrentSearchParams,
  type TorrentSearchResult,
} from "@/lib/server/indexers/types";
import { getDebridAvailabilityByInfoHash } from "@/lib/server/real-debrid/availability";
import { getSavedInfoHashes } from "@/lib/server/saved-items";

export type SearchIndexerFailure = {
  indexerId: string;
  indexerName: string;
  message: string;
};

export type IndexerSearchOutcome = {
  results: TorrentSearchResult[];
  failures: SearchIndexerFailure[];
  /** Number of enabled indexers the query was dispatched to. */
  indexersSearched: number;
};

/**
 * Fans a query out across every enabled indexer in parallel and merges the
 * normalized results. Each indexer is isolated: one failing (timeout, bad
 * response, auth error) becomes a {@link SearchIndexerFailure} rather than
 * aborting the whole search, so the UI can render partial results. Results are
 * de-duplicated by info hash (falling back to the adapter id) and sorted by
 * seeders descending.
 */
export async function searchAllIndexers(
  params: TorrentSearchParams,
  indexerIds?: string[],
): Promise<IndexerSearchOutcome> {
  const configs = await resolveEnabledConfigs(params, indexerIds);

  const settled = await Promise.allSettled(
    configs.map((config) => searchOne(config, params)),
  );

  const results: TorrentSearchResult[] = [];
  const failures: SearchIndexerFailure[] = [];

  settled.forEach((outcome, index) => {
    const config = configs[index];
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      failures.push(toFailure(config, outcome.reason));
    }
  });

  return {
    results: sortBySeeders(dedupeByInfoHash(results)),
    failures,
    indexersSearched: configs.length,
  };
}

/**
 * Streaming variant of {@link searchAllIndexers}. Yields a `start` event with
 * the indexer count, then one `results` or `error` event per indexer *as each
 * settles* (not after all complete), then `done`. Each indexer's results carry
 * their Real-Debrid availability so the client never needs a second round-trip.
 * De-dupe and sort move to the client, which merges incrementally. `signal`
 * propagates to the indexer fetches so a cancelled stream stops upstream work.
 */
export async function* streamIndexerSearch(
  params: TorrentSearchParams,
  signal?: AbortSignal,
  indexerIds?: string[],
): AsyncGenerator<SearchStreamEvent> {
  const configs = await resolveEnabledConfigs(params, indexerIds);
  yield { type: "start", indexersTotal: configs.length };

  // Tag each search with its index so we can drop it from the pending set the
  // moment it settles and yield results in completion order, not input order.
  const pending = new Map(
    configs.map((config, index) => [
      index,
      searchOne(config, { ...params, signal })
        .then((results) => ({ index, config, results, error: null as null }))
        .catch((reason) => ({
          index,
          config,
          results: null,
          error: toFailure(config, reason),
        })),
    ]),
  );

  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.index);

    if (signal?.aborted) {
      return;
    }

    if (settled.error) {
      yield {
        type: "error",
        indexerName: settled.error.indexerName,
        message: settled.error.message,
      };
      continue;
    }

    yield {
      type: "results",
      indexerId: settled.config.id,
      indexerName: settled.config.name,
      results: await toDtosWithAvailability(settled.results ?? []),
    };
  }

  yield { type: "done" };
}

/**
 * Loads enabled indexer configs, optionally scoped to a caller-provided id set.
 * An empty/absent `indexerIds` keeps the full enabled set (the default fan-out);
 * a non-empty list narrows to those ids, preserving stored order. Ids that don't
 * match an enabled indexer are simply ignored.
 */
async function resolveEnabledConfigs(
  params: TorrentSearchParams,
  indexerIds?: string[],
): Promise<IndexerConfig[]> {
  let configs = await loadEnabledIndexerConfigs();
  if (!indexerIds || indexerIds.length === 0) {
    return filterConfigsForParams(configs, params);
  }
  const wanted = new Set(indexerIds);
  configs = configs.filter((config) => wanted.has(config.id));
  return filterConfigsForParams(configs, params);
}

async function searchOne(
  config: IndexerConfig,
  params: TorrentSearchParams,
): Promise<TorrentSearchResult[]> {
  const adapter = getIndexerAdapter(config.type);
  return adapter.search(config, paramsForConfig(config, params));
}

function filterConfigsForParams(
  configs: IndexerConfig[],
  params: TorrentSearchParams,
): IndexerConfig[] {
  if (!isMangaSearch(params)) {
    return configs;
  }

  return configs.filter((config) => mangaCategoriesForConfig(config) !== null);
}

function paramsForConfig(
  config: IndexerConfig,
  params: TorrentSearchParams,
): TorrentSearchParams {
  if (!isMangaSearch(params)) {
    return params;
  }

  const categories = mangaCategoriesForConfig(config);
  return {
    ...params,
    categories: categories ?? [],
    imdbId: undefined,
    season: undefined,
    episode: undefined,
  };
}

function isMangaSearch(params: TorrentSearchParams): boolean {
  return Boolean(
    params.categories?.some((category) => category === "7030" || category === "7000"),
  );
}

function mangaCategoriesForConfig(config: IndexerConfig): string[] | null {
  if (config.type === "torrentio") {
    return null;
  }

  if (config.type === "torznab") {
    const configured = config.categories ?? [];
    if (configured.length === 0 || configured.some(isMangaCategory)) {
      return ["7030"];
    }
    return null;
  }

  const presetKey = presetKeyOf(config);
  if (presetKey === "anime-nyaa-si" || presetKey === "prowlarr-public-nyaasi") {
    return ["3_0"];
  }
  if (
    presetKey === "anime-tokyo-toshokan" ||
    presetKey === "prowlarr-public-tokyotosho"
  ) {
    return ["3"];
  }
  if (presetKey === "prowlarr-public-ehentai") {
    return ["1"];
  }

  const configured = config.categories ?? [];
  const textualMangaCategory = configured.find((category) =>
    category.toLowerCase().includes("manga"),
  );
  if (textualMangaCategory) {
    return [textualMangaCategory];
  }

  return configured.some(isMangaCategory) ? ["7030"] : null;
}

function isMangaCategory(category: string): boolean {
  return category === "7030" || category === "7000";
}

function presetKeyOf(config: IndexerConfig): string | undefined {
  const settings = config.settings;
  if (!settings) {
    return undefined;
  }
  return typeof settings.presetKey === "string" ? settings.presetKey : undefined;
}

/** Maps normalized results to client DTOs, stamping local Real-Debrid state. */
async function toDtosWithAvailability(
  results: TorrentSearchResult[],
): Promise<SearchResultDto[]> {
  const infoHashes = results
    .map((result) => result.infoHash)
    .filter((hash): hash is string => !!hash);
  const [availability, savedHashes] = await Promise.all([
    getDebridAvailabilityByInfoHash(infoHashes),
    getSavedInfoHashes(infoHashes),
  ]);

  return results.map((result) => ({
    id: result.id,
    title: result.title,
    sizeBytes: result.sizeBytes,
    seeders: result.seeders,
    leechers: result.leechers,
    publishedAt: result.publishedAt,
    indexerId: result.indexerId,
    indexerName: result.indexerName,
    magnetUrl: result.magnetUrl,
    infoHash: result.infoHash,
    sourceUrl: result.sourceUrl,
    debridState: (result.infoHash && availability.get(result.infoHash)) || "unknown",
    saved: result.infoHash ? savedHashes.has(result.infoHash) : false,
  }));
}

function toFailure(config: IndexerConfig, reason: unknown): SearchIndexerFailure {
  if (reason instanceof IndexerError) {
    return {
      indexerId: reason.indexerId ?? config.id,
      indexerName: reason.indexerName ?? config.name,
      message: reason.message,
    };
  }

  return {
    indexerId: config.id,
    indexerName: config.name,
    message: reason instanceof Error ? reason.message : "Indexer search failed.",
  };
}
