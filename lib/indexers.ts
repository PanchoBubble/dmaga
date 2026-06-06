/** Indexer adapter kind. Mirrors the DB enum. */
export type IndexerType = "torznab" | "cardigann" | "torrentio";

/** How an indexer's HTTP requests are fetched. Mirrors the DB enum. */
export type IndexerFetchMode = "direct" | "flaresolverr";

/**
 * An indexer as exposed to the client. Deliberately omits the API key: callers
 * only learn whether one is stored ({@link hasApiKey}), never its value.
 */
export type IndexerDto = {
  id: string;
  name: string;
  type: IndexerType;
  baseUrl: string;
  hasApiKey: boolean;
  fetchMode: IndexerFetchMode;
  enabled: boolean;
  /** Torznab/Newznab category ids applied when a search omits them. */
  categories: string[];
  /** ISO 8601 timestamp of the last connectivity test, when run. */
  lastTestedAt: string | null;
  /** Free-form outcome of the last test ("ok" or an error summary). */
  lastTestStatus: string | null;
  /** Stable key for built-in preset rows; custom indexers leave this null. */
  presetKey: string | null;
  /** Short user-facing note for built-in presets. */
  description: string | null;
  /** Whether the preset usually needs credentials before it can search. */
  requiresApiKey: boolean;
  /** Whether username/password credentials are stored server-side. */
  hasLoginCredentials: boolean;
};

/**
 * Create/update payload. `apiKey` is tri-state on update: omit (`undefined`) to
 * keep the stored key, `null` or `""` to clear it, a string to set a new one.
 */
export type IndexerInput = {
  name: string;
  type: IndexerType;
  baseUrl: string;
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  fetchMode: IndexerFetchMode;
  enabled: boolean;
  categories: string[];
};

/** Result of a connectivity/auth test against an indexer config. */
export type IndexerTestResult = {
  ok: boolean;
  message: string;
};

export const INDEXER_TYPE_LABELS: Record<IndexerType, string> = {
  cardigann: "Cardigann",
  torznab: "Torznab",
  torrentio: "Torrentio",
};

export const INDEXER_FETCH_MODE_LABELS: Record<IndexerFetchMode, string> = {
  direct: "Direct",
  flaresolverr: "FlareSolverr",
};

/** Parses a comma/whitespace-separated category string into clean ids. */
export function parseCategories(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}
