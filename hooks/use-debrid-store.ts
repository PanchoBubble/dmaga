import { create } from "zustand";

import type { AddToDebridRequest, AddToDebridResponse } from "@/lib/debrid";
import type { DebridAvailability, SearchResultDto } from "@/lib/search";

/** Phase of an in-progress (or just-finished) add action for one result. */
export type DebridEntryStatus = "adding" | "done" | "error";

export type DebridEntry = {
  status: DebridEntryStatus;
  /** Coarse availability once known; drives the result card's button + badge. */
  availability: DebridAvailability;
  progress: number;
  error?: string;
};

type DebridState = {
  /** Per-result add state, keyed by {@link entryKey}. */
  entries: Record<string, DebridEntry>;
  addToDebrid: (result: SearchResultDto) => Promise<AddToDebridResponse | null>;
};

/** Stable key for a result: prefer the info hash so dedup'd results share state. */
export function entryKey(result: Pick<SearchResultDto, "id" | "infoHash">): string {
  return result.infoHash ?? result.id;
}

export const useDebridStore = create<DebridState>((set, get) => ({
  entries: {},
  addToDebrid: async (result) => {
    const key = entryKey(result);

    if (get().entries[key]?.status === "adding") {
      return null;
    }

    set((state) => ({
      entries: {
        ...state.entries,
        [key]: { status: "adding", availability: "downloading", progress: 0 },
      },
    }));

    const body: AddToDebridRequest = {
      title: result.title,
      infoHash: result.infoHash,
      magnetUrl: result.magnetUrl,
      sizeBytes: result.sizeBytes,
      seeders: result.seeders,
      leechers: result.leechers,
      publishedAt: result.publishedAt,
      indexerId: result.indexerId,
      indexerName: result.indexerName,
      sourceUrl: result.sourceUrl,
      originSection: result.originSection,
    };

    try {
      const response = await fetch("/api/debrid/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | AddToDebridResponse
        | { error?: string };

      if (!response.ok || !("availability" in payload)) {
        const message =
          ("error" in payload && payload.error) || "Failed to add to Real-Debrid.";
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: {
              status: "error",
              availability: "unknown",
              progress: 0,
              error: message,
            },
          },
        }));
        return null;
      }

      set((state) => ({
        entries: {
          ...state.entries,
          [key]: {
            status: "done",
            availability: payload.availability,
            progress: payload.progress,
          },
        },
      }));
      return payload;
    } catch (error) {
      set((state) => ({
        entries: {
          ...state.entries,
          [key]: {
            status: "error",
            availability: "unknown",
            progress: 0,
            error: error instanceof Error ? error.message : "Failed to add.",
          },
        },
      }));
      return null;
    }
  },
}));
