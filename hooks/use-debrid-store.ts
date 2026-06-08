import { create } from "zustand";

import {
  isActiveDebridStatus,
  type AddedItemDto,
  type AddToDebridRequest,
  type AddToDebridResponse,
} from "@/lib/debrid";
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
  /** Sends a result to Real-Debrid. */
  addToDebrid: (result: SearchResultDto) => Promise<AddToDebridResponse | null>;
  /** Sends a result to the local qBittorrent (non-debrid) download path. */
  addToTorrent: (result: SearchResultDto) => Promise<AddToDebridResponse | null>;
};

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

/** Zustand's setter signature, shared by the add flow and the poller. */
type SetState = (
  partial:
    | DebridState
    | Partial<DebridState>
    | ((state: DebridState) => DebridState | Partial<DebridState>),
) => void;

/** Stable key for a result: prefer the info hash so dedup'd results share state. */
export function entryKey(result: Pick<SearchResultDto, "id" | "infoHash">): string {
  return result.infoHash ?? result.id;
}

export const useDebridStore = create<DebridState>((set, get) => ({
  entries: {},
  addToDebrid: (result) =>
    performAdd(result, "/api/debrid/add", "Failed to add to Real-Debrid.", set, get),
  addToTorrent: (result) =>
    performAdd(result, "/api/torrents/add", "Failed to add to qBittorrent.", set, get),
}));

/**
 * Shared add flow: optimistically marks the result as adding, POSTs to the
 * given endpoint, then reflects the returned status and starts polling when the
 * item is still working. Real-Debrid and torrent adds share this because both
 * return an {@link AddToDebridResponse} and are tracked by the same poller.
 */
async function performAdd(
  result: SearchResultDto,
  endpoint: string,
  fallbackError: string,
  set: SetState,
  get: () => DebridState,
): Promise<AddToDebridResponse | null> {
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
    title: result.displayTitle ?? result.title,
    previewImageUrl: result.previewImageUrl,
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
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as AddToDebridResponse | { error?: string };

    if (!response.ok || !("availability" in payload)) {
      const message = ("error" in payload && payload.error) || fallbackError;
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
          status: isActiveDebridStatus(payload.status) ? "adding" : "done",
          availability: payload.availability,
          progress: payload.progress,
        },
      },
    }));
    if (isActiveDebridStatus(payload.status)) {
      pollDebridEntry(key, payload.debridItemId, set);
    }
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
}

function pollDebridEntry(
  key: string,
  debridItemId: string,
  set: SetState,
  attempt = 0,
) {
  if (attempt >= MAX_POLL_ATTEMPTS) {
    return;
  }

  window.setTimeout(async () => {
    try {
      const response = await fetch(`/api/debrid/items/${debridItemId}`);
      const payload = (await response.json()) as
        | { item: AddedItemDto }
        | { error?: string };

      if (!response.ok || !("item" in payload)) {
        return;
      }

      const item = payload.item;
      const active = isActiveDebridStatus(item.status);
      set((state) => ({
        entries: {
          ...state.entries,
          [key]: {
            status: active ? "adding" : item.status === "error" ? "error" : "done",
            availability: item.availability,
            progress: item.progress,
            error: item.errorMessage ?? undefined,
          },
        },
      }));

      if (active) {
        pollDebridEntry(key, debridItemId, set, attempt + 1);
      }
    } catch {
      pollDebridEntry(key, debridItemId, set, attempt + 1);
    }
  }, POLL_INTERVAL_MS);
}
