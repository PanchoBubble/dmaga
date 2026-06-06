import { create } from "zustand";

import type { MediaCategory } from "@/lib/mock-media";
import {
  dedupeByInfoHash,
  sortResults,
  torznabCategoriesFor,
  type SearchIndexerError,
  type SearchResultDto,
  type SearchStreamEvent,
  type SortKey,
} from "@/lib/search";

export type SearchStatus = "idle" | "loading" | "success" | "error";

/** Minimal indexer identity the filter modal needs; loaded from /api/indexers. */
export type IndexerOption = { id: string; name: string };

const SELECTED_INDEXERS_KEY = "dmaga:selected-indexers";

/**
 * Reads the persisted indexer scope. `null` (the default, also stored as the
 * sentinel "all") means "every enabled indexer". An array is an explicit,
 * narrowed selection of indexer ids.
 */
function readStoredSelection(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SELECTED_INDEXERS_KEY);
    if (!raw || raw === "all") {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : null;
  } catch {
    return null;
  }
}

function writeStoredSelection(selection: string[] | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      SELECTED_INDEXERS_KEY,
      selection === null ? "all" : JSON.stringify(selection),
    );
  } catch {
    // Best-effort persistence; a full/disabled store just falls back to memory.
  }
}

type SearchState = {
  query: string;
  category: MediaCategory;
  status: SearchStatus;
  /** The query that produced the current results, for empty-state messaging. */
  lastQuery: string;
  results: SearchResultDto[];
  /** Per-indexer failures from the last search (partial-failure surface). */
  indexerErrors: SearchIndexerError[];
  /** Number of enabled indexers the last search reached; 0 hints at setup. */
  indexersSearched: number;
  /** Indexers that have reported (success or failure) so far this search. */
  indexersCompleted: number;
  /** True when the user stopped a search early; results are partial. */
  stopped: boolean;
  /** Fatal error message when the whole search request failed. */
  error: string | null;
  /** Client-side filter to a single indexer name; null shows every indexer. */
  indexerFilter: string | null;
  /** Display sort applied to results; seeders descending by default. */
  sortKey: SortKey;
  /** Enabled indexers available to scope a search to, for the filter modal. */
  availableIndexers: IndexerOption[];
  /** True once the indexer list has been fetched at least once. */
  indexersLoaded: boolean;
  /**
   * Pre-search scope: which enabled indexers the query is dispatched to. `null`
   * means "all" (the default); `[]` means none selected (search is blocked).
   */
  selectedIndexerIds: string[] | null;
  setQuery: (query: string) => void;
  setCategory: (category: MediaCategory) => void;
  setIndexerFilter: (indexerName: string | null) => void;
  setSortKey: (sortKey: SortKey) => void;
  /**
   * Restores the persisted indexer scope from localStorage. Called from a mount
   * effect (not the store initializer) so the first client render matches the
   * server's (which has no localStorage), avoiding a hydration mismatch.
   */
  hydrateSelection: () => void;
  loadIndexers: () => Promise<void>;
  setSelectedIndexerIds: (ids: string[] | null) => void;
  runSearch: () => Promise<void>;
  stopSearch: () => void;
};

let activeSearch: AbortController | null = null;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  category: "all",
  status: "idle",
  lastQuery: "",
  results: [],
  indexerErrors: [],
  indexersSearched: 0,
  indexersCompleted: 0,
  stopped: false,
  error: null,
  indexerFilter: null,
  sortKey: "seeds",
  availableIndexers: [],
  indexersLoaded: false,
  // Seed with the SSR-safe default ("all"); the real persisted value is loaded
  // client-side via hydrateSelection() after mount.
  selectedIndexerIds: null,
  setQuery: (query) => set({ query }),
  setIndexerFilter: (indexerName) => set({ indexerFilter: indexerName }),
  hydrateSelection: () => set({ selectedIndexerIds: readStoredSelection() }),
  setSortKey: (sortKey) =>
    // Re-sort what's already loaded; streaming batches use the same key.
    set((state) => ({ sortKey, results: sortResults(state.results, sortKey) })),
  loadIndexers: async () => {
    try {
      const response = await fetch("/api/indexers", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        indexers?: { id: string; name: string; enabled: boolean }[];
      };
      const available = (payload.indexers ?? [])
        .filter((indexer) => indexer.enabled)
        .map((indexer) => ({ id: indexer.id, name: indexer.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Reconcile any persisted selection against the indexers that still
      // exist. A stored subset that now covers every available indexer (or is
      // empty after pruning) collapses back to "all".
      set((state) => {
        const availableIds = new Set(available.map((indexer) => indexer.id));
        let selection = state.selectedIndexerIds;
        if (selection) {
          const pruned = selection.filter((id) => availableIds.has(id));
          selection =
            pruned.length === 0 || pruned.length === available.length ? null : pruned;
        }
        return { availableIndexers: available, indexersLoaded: true, selectedIndexerIds: selection };
      });
    } catch {
      // Offline or transient failure: the modal just shows whatever we have.
    }
  },
  setSelectedIndexerIds: (ids) => {
    // Normalize "everything selected" to the null ("all") sentinel so the
    // count badge and persisted value stay canonical.
    const { availableIndexers } = get();
    const normalized =
      ids !== null && ids.length === availableIndexers.length && availableIndexers.length > 0
        ? null
        : ids;
    set({ selectedIndexerIds: normalized });
    writeStoredSelection(normalized);
    // Mirror setCategory: re-run immediately so changing scope updates results
    // without a second manual search, but only when a query is already active
    // and at least one indexer remains selected.
    if (get().lastQuery && !(normalized && normalized.length === 0)) {
      void get().runSearch();
    }
  },
  setCategory: (category) => {
    set({ category });
    // Re-run with the new category filter if we've already searched, so tapping
    // a chip updates results immediately instead of appearing to do nothing.
    if (get().lastQuery) {
      void get().runSearch();
    }
  },
  stopSearch: () => {
    // Abort the stream but keep whatever streamed in; mark it partial. The
    // in-flight reader sees AbortError and bails without touching state.
    if (!activeSearch) {
      return;
    }
    activeSearch.abort();
    activeSearch = null;
    set({ status: "success", stopped: true });
  },
  runSearch: async () => {
    const query = get().query.trim();
    if (!query) {
      return;
    }

    // An explicit empty scope means the user deselected every indexer; there is
    // nothing to query, so bail without touching the existing results.
    const scope = get().selectedIndexerIds;
    if (scope && scope.length === 0) {
      return;
    }

    // Cancel any in-flight search so out-of-order responses can't clobber state.
    activeSearch?.abort();
    const controller = new AbortController();
    activeSearch = controller;

    set({
      status: "loading",
      error: null,
      lastQuery: query,
      results: [],
      indexerErrors: [],
      indexersSearched: 0,
      indexersCompleted: 0,
      stopped: false,
      // A new query invalidates any indexer the user had narrowed to.
      indexerFilter: null,
    });

    const params = new URLSearchParams({ q: query });
    for (const category of torznabCategoriesFor(get().category)) {
      params.append("cat", category);
    }
    // Only narrow when the user has an explicit subset; `null` lets the server
    // fan out to every enabled indexer.
    if (scope) {
      for (const indexerId of scope) {
        params.append("indexer", indexerId);
      }
    }

    try {
      const response = await fetch(`/api/search?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let message = "Search failed. Try again.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Non-JSON body; keep the generic message.
        }
        set({ status: "error", error: message });
        return;
      }

      await consumeStream(response.body, (event) => applyEvent(set, get, event));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      set({
        status: "error",
        error: error instanceof Error ? error.message : "Search failed. Try again.",
      });
    } finally {
      if (activeSearch === controller) {
        activeSearch = null;
      }
    }
  },
}));

type SetState = (
  partial: Partial<SearchState> | ((state: SearchState) => Partial<SearchState>),
) => void;

/** Folds a single stream event into the store. */
function applyEvent(
  set: SetState,
  get: () => SearchState,
  event: SearchStreamEvent,
): void {
  switch (event.type) {
    case "start":
      set({ indexersSearched: event.indexersTotal });
      return;
    case "results":
      set((state) => ({
        // Merge incrementally: later batches can outrank earlier ones, so
        // re-dedupe and re-sort the whole set on each batch by the active key.
        results: sortResults(
          dedupeByInfoHash([...state.results, ...event.results]),
          state.sortKey,
        ),
        indexersCompleted: state.indexersCompleted + 1,
      }));
      return;
    case "error":
      set((state) => ({
        indexerErrors: [
          ...state.indexerErrors,
          { indexerName: event.indexerName, message: event.message },
        ],
        indexersCompleted: state.indexersCompleted + 1,
      }));
      return;
    case "done":
      set({ status: "success" });
      return;
    case "fatal":
      set({ status: "error", error: event.message });
      return;
  }
}

/** Reads an SSE byte stream and dispatches each `data:` frame as it arrives. */
async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SearchStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
      if (dataLine) {
        onEvent(JSON.parse(dataLine.slice(5).trim()) as SearchStreamEvent);
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
