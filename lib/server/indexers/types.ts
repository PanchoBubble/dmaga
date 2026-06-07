/**
 * Prowlarr/Cardigann-inspired indexer adapter model.
 *
 * An {@link IndexerAdapter} takes a stored {@link IndexerConfig} plus runtime
 * {@link TorrentSearchParams} and returns a normalized list of
 * {@link TorrentSearchResult}. Phase 1 ships Torznab plus a native
 * Cardigann-style public preset adapter.
 */

export type IndexerFetchMode = "direct" | "flaresolverr";

/**
 * Adapter discriminator. `cardigann` is used for native public Prowlarr
 * definitions that the app can execute without a Torznab proxy.
 */
export type IndexerType =
  | "torznab"
  | "cardigann"
  | "torrentio"
  | "internet_archive"
  | "minerva";

export type IndexerConfig = {
  id: string;
  name: string;
  type: IndexerType;
  /** Torznab API endpoint (e.g. `https://host/api` or a Prowlarr indexer URL). */
  baseUrl: string;
  /** Decrypted API key, when the indexer requires one. */
  apiKey?: string;
  fetchMode: IndexerFetchMode;
  enabled: boolean;
  /** Default Torznab/Newznab category ids applied when a search omits them. */
  categories?: string[];
  /** Adapter-specific configuration; reserved for definition-based indexers. */
  settings?: Record<string, unknown>;
};

export type TorrentSearchParams = {
  query: string;
  /** Category ids; falls back to the indexer's configured defaults when empty. */
  categories?: string[];
  /** Soft cap on results requested from the indexer. */
  limit?: number;
  /** Aborts the underlying fetch when the client cancels or disconnects. */
  signal?: AbortSignal;
  /**
   * Known IMDB id (`tt123`) for the search target. Id-aware adapters
   * (Torrentio) use it to fetch exact streams and skip keyword resolution;
   * keyword adapters (Torznab/Cardigann) ignore it and use {@link query}.
   * Set by the title detail page, never by the free-text search box.
   */
  imdbId?: string;
  /** Series season, paired with {@link episode}, for episode-level lookups. */
  season?: number;
  /** Series episode number, paired with {@link season}. */
  episode?: number;
};

export type TorrentSearchResult = {
  /** Stable id derived from indexer + info hash/guid/source, for dedupe + keys. */
  id: string;
  title: string;
  sizeBytes?: number;
  seeders?: number;
  leechers?: number;
  /** ISO 8601 publish timestamp, when the indexer reports one. */
  publishedAt?: string;
  indexerId: string;
  indexerName: string;
  magnetUrl?: string;
  infoHash?: string;
  sourceUrl?: string;
};

/** Outcome of an adapter connectivity/auth probe. */
export type IndexerTestOutcome = {
  ok: boolean;
  message: string;
};

export interface IndexerAdapter {
  /** The {@link IndexerType} this adapter handles; used for registry lookup. */
  readonly type: IndexerType;
  search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]>;
  /**
   * Probes the indexer (reachability + credentials) without persisting. Throws
   * an {@link IndexerError} on failure so callers can surface the reason.
   */
  test(config: IndexerConfig): Promise<IndexerTestOutcome>;
}

/** Raised when an indexer fetch or parse fails; carries indexer identity. */
export class IndexerError extends Error {
  readonly indexerId?: string;
  readonly indexerName?: string;

  constructor(
    message: string,
    options: { indexerId?: string; indexerName?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "IndexerError";
    this.indexerId = options.indexerId;
    this.indexerName = options.indexerName;
  }
}
