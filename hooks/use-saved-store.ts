import { create } from "zustand";

import { entryKey } from "@/hooks/use-debrid-store";
import type { SetSavedRequest, SetSavedResponse } from "@/lib/saved";
import type { SearchResultDto } from "@/lib/search";

/** Optimistic saved state for one result, keyed by {@link entryKey}. */
type SavedEntry = {
  saved: boolean;
  /** True while a toggle request is in flight; disables the star. */
  pending: boolean;
};

type SavedState = {
  entries: Record<string, SavedEntry>;
  /**
   * Flips saved state for a result optimistically, persists it, and reverts on
   * failure. `current` is the star's pre-click state. Resolves to the saved
   * state the caller should now reflect.
   */
  toggleSaved: (result: SearchResultDto, current: boolean) => Promise<boolean>;
};

export const useSavedStore = create<SavedState>((set, get) => ({
  entries: {},
  toggleSaved: async (result, current) => {
    const key = entryKey(result);

    // Ignore re-clicks while a toggle is still resolving.
    if (get().entries[key]?.pending) {
      return current;
    }

    const next = !current;
    set((state) => ({
      entries: { ...state.entries, [key]: { saved: next, pending: true } },
    }));

    const body: SetSavedRequest = {
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
      saved: next,
    };

    try {
      const response = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as
        | SetSavedResponse
        | { error?: string };

      if (!response.ok || !("saved" in payload)) {
        throw new Error(
          ("error" in payload && payload.error) || "Failed to update saved state.",
        );
      }

      set((state) => ({
        entries: { ...state.entries, [key]: { saved: payload.saved, pending: false } },
      }));
      return payload.saved;
    } catch {
      // Revert the optimistic flip so the star matches the persisted state.
      set((state) => ({
        entries: { ...state.entries, [key]: { saved: current, pending: false } },
      }));
      return current;
    }
  },
}));
