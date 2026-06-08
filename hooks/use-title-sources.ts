"use client";

import { useCallback, useEffect, useState } from "react";

import type { CatalogType } from "@/lib/metadata";
import {
  dedupeByInfoHash,
  sortResults,
  type SearchIndexerError,
  type SearchResultDto,
  type SearchStreamEvent,
  type SortKey,
  type MediaOriginSection,
} from "@/lib/search";

export type TitleSourcesArgs = {
  /** Keyword query for keyword indexers (Torznab/Cardigann). */
  query: string;
  /** IMDB id for id-aware indexers (Torrentio); skips their Cinemeta lookup. */
  imdbId?: string;
  type: CatalogType | "manga";
  /** Optional Torznab categories; overrides the movie/series defaults. */
  categories?: string[];
  /** Season/episode, for series episode-level source lookups. */
  season?: number;
  episode?: number;
  /** Optional override for Added grouping. */
  originSection?: MediaOriginSection;
};

export type TitleSourcesState = {
  results: SearchResultDto[];
  errors: SearchIndexerError[];
  status: "idle" | "loading" | "success" | "error";
  indexersSearched: number;
  indexersCompleted: number;
  error: string | null;
};

/** Torznab buckets so keyword indexers scope the right section. */
function categoriesFor(type: CatalogType | "manga"): string[] {
  if (type === "manga") {
    return ["7030"];
  }
  return type === "series" ? ["5000"] : ["2000"];
}

/**
 * Streams torrent sources for one title (or episode) over the existing
 * `/api/search` SSE pipeline, reusing the same dedupe/sort as the search page.
 * Re-runs whenever the target changes; aborts the in-flight stream on change or
 * unmount. `sortKey` controls display ordering of the accumulated results.
 */
export function useTitleSources(
  args: TitleSourcesArgs | null,
  sortKey: SortKey = "seeds",
  indexerIds: string[] | null = null,
): TitleSourcesState & { retry: () => void } {
  const [state, setState] = useState<TitleSourcesState>(initialState);

  // Stable key so the effect only re-runs when the actual target changes.
  const key = args
    ? `${args.type}|${args.imdbId ?? ""}|${args.season ?? ""}|${args.episode ?? ""}|${args.categories?.join(",") ?? ""}|${args.query}|${indexerIds?.join(",") ?? "all"}`
    : null;

  const [runId, setRunId] = useState(0);
  const retry = useCallback(() => setRunId((id) => id + 1), []);

  useEffect(() => {
    if (!args || !key) {
      setState(initialState);
      return;
    }
    if (indexerIds && indexerIds.length === 0) {
      setState(initialState);
      return;
    }

    const controller = new AbortController();
    setState({ ...initialState, status: "loading" });

    const params = new URLSearchParams({ q: args.query });
    for (const category of args.categories ?? categoriesFor(args.type)) {
      params.append("cat", category);
    }
    if (args.imdbId) {
      params.set("imdbId", args.imdbId);
    }
    if (args.season != null) {
      params.set("season", String(args.season));
    }
    if (args.episode != null) {
      params.set("episode", String(args.episode));
    }
    params.set("origin", args.originSection ?? originSectionFor(args.type));
    if (indexerIds) {
      for (const indexerId of indexerIds) {
        params.append("indexer", indexerId);
      }
    }

    void (async () => {
      try {
        const response = await fetch(`/api/search?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Failed to load sources.",
          }));
          return;
        }
        await consumeStream(response.body, (event) =>
          setState((prev) => applyEvent(prev, event, sortKey)),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load sources.",
        }));
      }
    })();

    return () => controller.abort();
    // `key` captures every meaningful field of `args` and indexer scope;
    // `runId` forces a retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, runId, sortKey]);

  return { ...state, retry };
}

function originSectionFor(type: CatalogType | "manga"): MediaOriginSection {
  if (type === "movie") {
    return "movie";
  }
  if (type === "series") {
    return "show";
  }
  return "manga";
}

const initialState: TitleSourcesState = {
  results: [],
  errors: [],
  status: "idle",
  indexersSearched: 0,
  indexersCompleted: 0,
  error: null,
};

function applyEvent(
  state: TitleSourcesState,
  event: SearchStreamEvent,
  sortKey: SortKey,
): TitleSourcesState {
  switch (event.type) {
    case "start":
      return { ...state, indexersSearched: event.indexersTotal };
    case "results":
      return {
        ...state,
        results: sortResults(
          dedupeByInfoHash([...state.results, ...event.results]),
          sortKey,
        ),
        indexersCompleted: state.indexersCompleted + 1,
      };
    case "error":
      return {
        ...state,
        errors: [
          ...state.errors,
          { indexerName: event.indexerName, message: event.message },
        ],
        indexersCompleted: state.indexersCompleted + 1,
      };
    case "done":
      return { ...state, status: "success" };
    case "fatal":
      return { ...state, status: "error", error: event.message };
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
