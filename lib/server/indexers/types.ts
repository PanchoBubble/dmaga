/**
 * Prowlarr/Cardigann-inspired indexer adapter model.
 *
 * An {@link IndexerAdapter} takes a stored {@link IndexerConfig} plus runtime
 * {@link TorrentSearchParams} and returns a normalized list of
 * {@link TorrentSearchResult}. Phase 1 ships a generic Torznab adapter; the
 * `type` discriminator and the per-adapter `settings` bag leave room for
 * definition-based (Cardigann-style) indexers later without changing callers.
 */

export type IndexerFetchMode = "direct" | "flaresolverr";

/**
 * Adapter discriminator. Only `"torznab"` exists today; future definition-based
 * indexers add a variant here and register an adapter in the registry.
 */
export type IndexerType = "torznab";

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

export interface IndexerAdapter {
  /** The {@link IndexerType} this adapter handles; used for registry lookup. */
  readonly type: IndexerType;
  search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]>;
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
