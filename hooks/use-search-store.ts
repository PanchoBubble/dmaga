import { create } from "zustand";

import type { MediaCategory } from "@/lib/mock-media";
import {
  dedupeByInfoHash,
  sortBySeeders,
  torznabCategoriesFor,
  type SearchIndexerError,
  type SearchResultDto,
  type SearchStreamEvent,
} from "@/lib/search";

export type SearchStatus = "idle" | "loading" | "success" | "error";

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
  setQuery: (query: string) => void;
  setCategory: (category: MediaCategory) => void;
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
  setQuery: (query) => set({ query }),
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
    });

    const params = new URLSearchParams({ q: query });
    for (const category of torznabCategoriesFor(get().category)) {
      params.append("cat", category);
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
        // Merge incrementally: later high-seeder results can outrank earlier
        // ones, so re-dedupe and re-sort the whole set on each batch.
        results: sortBySeeders(dedupeByInfoHash([...state.results, ...event.results])),
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
