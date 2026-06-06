import { create } from "zustand";

import type { IndexerDto, IndexerInput, IndexerTestResult } from "@/lib/indexers";

/** Payload for the stateless test endpoint (ad-hoc or saved config). */
export type IndexerTestPayload = Omit<IndexerInput, "enabled"> & { id?: string };

type IndexerState = {
  indexers: IndexerDto[];
  /** True only while the initial server-provided list hasn't been set. */
  hydrated: boolean;
  setIndexers: (indexers: IndexerDto[]) => void;
  refresh: () => Promise<void>;
  create: (input: IndexerInput) => Promise<IndexerDto>;
  update: (id: string, input: Partial<IndexerInput>) => Promise<IndexerDto>;
  remove: (id: string) => Promise<void>;
  test: (payload: IndexerTestPayload) => Promise<IndexerTestResult>;
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export const useIndexerStore = create<IndexerState>((set, get) => ({
  indexers: [],
  hydrated: false,
  setIndexers: (indexers) => set({ indexers, hydrated: true }),

  refresh: async () => {
    const response = await fetch("/api/indexers", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await readError(response, "Unable to load indexers."));
    }
    const body = (await response.json()) as { indexers: IndexerDto[] };
    set({ indexers: body.indexers, hydrated: true });
  },

  create: async (input) => {
    const response = await fetch("/api/indexers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await readError(response, "Unable to create indexer."));
    }
    const { indexer } = (await response.json()) as { indexer: IndexerDto };
    set((state) => ({ indexers: [indexer, ...state.indexers] }));
    return indexer;
  },

  update: async (id, input) => {
    const response = await fetch(`/api/indexers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await readError(response, "Unable to update indexer."));
    }
    const { indexer } = (await response.json()) as { indexer: IndexerDto };
    set((state) => ({
      indexers: state.indexers.map((item) => (item.id === id ? indexer : item)),
    }));
    return indexer;
  },

  remove: async (id) => {
    const response = await fetch(`/api/indexers/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(await readError(response, "Unable to delete indexer."));
    }
    set((state) => ({
      indexers: state.indexers.filter((item) => item.id !== id),
    }));
  },

  test: async (payload) => {
    const response = await fetch("/api/indexers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readError(response, "Unable to test indexer."));
    }
    const result = (await response.json()) as IndexerTestResult;
    // A saved indexer's test updates its lastTested fields server-side; pull the
    // fresh row in so the list reflects the new status without a full reload.
    if (payload.id) {
      void get().refresh();
    }
    return result;
  },
}));
