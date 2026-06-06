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
): Promise<IndexerSearchOutcome> {
  const configs = await loadEnabledIndexerConfigs();

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
): AsyncGenerator<SearchStreamEvent> {
  const configs = await loadEnabledIndexerConfigs();
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

async function searchOne(
  config: IndexerConfig,
  params: TorrentSearchParams,
): Promise<TorrentSearchResult[]> {
  const adapter = getIndexerAdapter(config.type);
  return adapter.search(config, params);
}

/** Maps normalized results to client DTOs, stamping local Real-Debrid state. */
async function toDtosWithAvailability(
  results: TorrentSearchResult[],
): Promise<SearchResultDto[]> {
  const availability = await getDebridAvailabilityByInfoHash(
    results.map((result) => result.infoHash).filter((hash): hash is string => !!hash),
  );

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
