import type { FilterableMediaCategory, MediaCategory } from "@/lib/mock-media";

/**
 * Real-Debrid availability of a search result, when we can determine it.
 * `unknown` means we have no local record of the torrent — the default for
 * fresh results until they are added to Debrid.
 */
export type DebridAvailability = "ready" | "downloading" | "saved" | "unknown";

/** Section/category a torrent was added from, used to organize Added items. */
export type MediaOriginSection = "movie" | "show" | "mal" | "manga" | "other";

/** A normalized torrent search result as sent to the client. */
export type SearchResultDto = {
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
  /** Local Real-Debrid state for this torrent, when known. */
  debridState: DebridAvailability;
  /** True when the user has starred (favorited) this torrent. */
  saved?: boolean;
  /** Section/category that produced the result. */
  originSection?: MediaOriginSection;
};

/** A single indexer that failed during a fan-out search (partial failure). */
export type SearchIndexerError = {
  indexerName: string;
  message: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResultDto[];
  /** Indexers that errored while others may have succeeded. */
  errors: SearchIndexerError[];
  /** Number of enabled indexers the query was dispatched to. */
  indexersSearched: number;
};

/**
 * A single frame in the streaming search response (SSE `data:` payload). The
 * server emits `start` once, then one `results` or `error` per indexer as each
 * settles, then `done`. `fatal` is reserved for whole-search failures (e.g. the
 * config load throwing before any indexer ran).
 */
export type SearchStreamEvent =
  | { type: "start"; indexersTotal: number }
  | {
      type: "results";
      indexerId: string;
      indexerName: string;
      results: SearchResultDto[];
    }
  | { type: "error"; indexerName: string; message: string }
  | { type: "done" }
  | { type: "fatal"; message: string };

/**
 * Keeps the highest-seeded entry when the same torrent appears across indexers,
 * keyed by info hash (falling back to the stable id). Shared by the server
 * fan-out and the client store, which de-dupes incrementally as results stream.
 */
export function dedupeByInfoHash<
  T extends { id: string; infoHash?: string; seeders?: number },
>(results: T[]): T[] {
  const byKey = new Map<string, T>();

  for (const result of results) {
    const key = result.infoHash ?? result.id;
    const existing = byKey.get(key);
    if (!existing || (result.seeders ?? 0) > (existing.seeders ?? 0)) {
      byKey.set(key, result);
    }
  }

  return [...byKey.values()];
}

/** Sorts results by seeders descending; stable enough for progressive merges. */
export function sortBySeeders<T extends { seeders?: number }>(results: T[]): T[] {
  return [...results].sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0));
}

/** Display sort options offered in the results header. All are descending. */
export type SortKey = "seeds" | "size" | "peers" | "age";

export const sortOptions: { key: SortKey; label: string }[] = [
  { key: "seeds", label: "Seeds" },
  { key: "size", label: "Size" },
  { key: "peers", label: "Peers" },
  { key: "age", label: "Newest" },
];

type SortableResult = {
  seeders?: number;
  leechers?: number;
  sizeBytes?: number;
  publishedAt?: string;
};

/** Numeric ranking value for a result under the given key (higher sorts first). */
function rankFor(result: SortableResult, key: SortKey): number {
  switch (key) {
    case "seeds":
      return result.seeders ?? 0;
    case "peers":
      return result.leechers ?? 0;
    case "size":
      return result.sizeBytes ?? 0;
    case "age": {
      // Newest first; results with no timestamp sort to the bottom.
      const ms = result.publishedAt ? Date.parse(result.publishedAt) : Number.NaN;
      return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
    }
  }
}

/** Sorts results descending by the chosen key; ties fall back to seeders. */
export function sortResults<T extends SortableResult>(results: T[], key: SortKey): T[] {
  return [...results].sort((a, b) => {
    const delta = rankFor(b, key) - rankFor(a, key);
    return delta !== 0 ? delta : (b.seeders ?? 0) - (a.seeders ?? 0);
  });
}

/**
 * Maps the app's coarse media categories onto standard Newznab/Torznab category
 * ids. `all` returns no ids so each indexer falls back to its own configured
 * defaults. These are the conventional top-level buckets shared across trackers.
 */
const categoryTorznabIds: Record<Exclude<MediaCategory, "all">, string[]> = {
  movies: ["2000"],
  tv: ["5000"],
  anime: ["5070"],
  manga: ["7030"],
  games: ["1000", "4050"],
  music: ["3000"],
};

export function torznabCategoriesFor(category: MediaCategory): string[] {
  return category === "all" ? [] : categoryTorznabIds[category];
}

/**
 * Maps a multi-select category scope onto the union of its Torznab ids. A
 * `null` scope (the "all" sentinel) returns no ids so each indexer falls back
 * to its own defaults; ids are de-duplicated since buckets can overlap.
 */
export function torznabCategoriesForSelection(
  categories: FilterableMediaCategory[] | null,
): string[] {
  if (!categories || categories.length === 0) {
    return [];
  }
  const ids = new Set<string>();
  for (const category of categories) {
    for (const id of categoryTorznabIds[category]) {
      ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Builds a `magnet:` URI for opening a result in the user's torrent client.
 * Prefers the indexer-provided magnet; otherwise synthesizes one from the info
 * hash (with the title as the display name). Returns null when neither exists.
 */
export function magnetLinkFor(result: {
  magnetUrl?: string;
  infoHash?: string;
  title?: string;
}): string | null {
  if (result.magnetUrl) {
    return result.magnetUrl;
  }
  if (result.infoHash) {
    const name = result.title ? `&dn=${encodeURIComponent(result.title)}` : "";
    return `magnet:?xt=urn:btih:${result.infoHash}${name}`;
  }
  return null;
}

export function isTorrentFileUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith(".torrent");
  } catch {
    return url.toLowerCase().includes(".torrent");
  }
}

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

/** Formats a byte count as a human-readable string (binary units). */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1) {
    return "0 B";
  }

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    SIZE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const precision = value >= 100 || exponent === 0 ? 0 : 1;

  return `${value.toFixed(precision)} ${SIZE_UNITS[exponent]}`;
}

/**
 * Formats an ISO timestamp as a short relative age (e.g. `2h`, `3d`, `5mo`).
 * `nowMs` is injectable so callers/tests can pin "now"; defaults to wall clock.
 */
export function formatRelativeAge(
  isoDate: string | undefined,
  nowMs: number = Date.now(),
): string {
  if (!isoDate) {
    return "—";
  }
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) {
    return "—";
  }

  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 60) {
    return "just now";
  }

  const units: [limit: number, secs: number, suffix: string][] = [
    [60, 60, "m"],
    [24, 3600, "h"],
    [30, 86400, "d"],
    [12, 2592000, "mo"],
    [Number.POSITIVE_INFINITY, 31536000, "y"],
  ];

  for (const [limit, secs, suffix] of units) {
    const value = Math.floor(seconds / secs);
    if (value < limit) {
      return `${value}${suffix}`;
    }
  }

  return "—";
}
