import type { DebridAvailability, MediaOriginSection } from "@/lib/search";

/**
 * Granular lifecycle of a locally-tracked Real-Debrid item. Mirrors the
 * `debrid_item_status` Postgres enum (see {@link file://./db/schema.ts}); kept as
 * a standalone union here so client bundles never import the Drizzle schema.
 */
export type DebridItemStatus =
  | "saved"
  | "adding"
  | "waiting_files_selection"
  | "queued"
  | "downloading"
  | "ready"
  | "error"
  | "deleted";

/**
 * How a tracked item is delivered. Mirrors the `media_provider` Postgres enum.
 * `real_debrid` is the original path; `torrent` is a local qBittorrent download
 * served from disk; `direct` streams from an indexer-provided HTTP URL.
 */
export type MediaProvider = "real_debrid" | "torrent" | "direct";

/** Fields the client sends to add a search result to Real-Debrid. */
export type AddToDebridRequest = {
  title: string;
  previewImageUrl?: string;
  infoHash?: string;
  magnetUrl?: string;
  sizeBytes?: number;
  seeders?: number;
  leechers?: number;
  /** ISO 8601 publish timestamp from the indexer, when known. */
  publishedAt?: string;
  indexerId?: string;
  indexerName: string;
  /** Indexer-provided source. Can be a details page or a .torrent URL. */
  sourceUrl?: string;
  /** Section/category that produced this result. */
  originSection?: MediaOriginSection;
};

/** Result of an add-to-Debrid action, used to transition the search UI. */
export type AddToDebridResponse = {
  mediaItemId: string;
  debridItemId: string;
  torrentId: string | null;
  status: DebridItemStatus;
  /** Coarse availability the result card renders from. */
  availability: DebridAvailability;
  /** Download progress 0–100 reported by Real-Debrid. */
  progress: number;
  filename?: string;
  /** First PDF/image/CBZ-style file available for the manga reader, when present. */
  primaryReadableLinkId?: string;
  /** True when the item already existed and is downloadable (no re-add). */
  reused: boolean;
};

/** A tracked Real-Debrid item as rendered on the Added page. */
export type AddedItemDto = {
  id: string;
  mediaItemId: string;
  title: string;
  previewImageUrl: string | null;
  indexerName: string;
  originSection: MediaOriginSection;
  sizeBytes: number | null;
  status: DebridItemStatus;
  availability: DebridAvailability;
  provider: MediaProvider;
  progress: number;
  torrentId: string | null;
  infoHash: string | null;
  errorMessage: string | null;
  links: AddedItemLinkDto[];
  /** ISO 8601 timestamp the item was sent to Real-Debrid, when known. */
  addedAt: string | null;
  /** ISO 8601 timestamp of the last local state change. */
  updatedAt: string;
};

/** Downloadable link associated with a completed Added item. */
export type AddedItemLinkDto = {
  id: string;
  fileName: string;
  fileSizeBytes: number | null;
  host: string | null;
  originalLink: string;
  unrestrictedLink: string | null;
  streamable: boolean;
  hostDownload: HostDownloadDto | null;
};

export type HostDownloadStatus =
  | "queued"
  | "running"
  | "complete"
  | "error"
  | "cancelled";

export type HostDownloadDto = {
  id: string;
  status: HostDownloadStatus;
  targetPath: string;
  bytesDownloaded: number;
  errorMessage: string | null;
};

const STATUS_LABELS: Record<DebridItemStatus, string> = {
  saved: "Saved",
  adding: "Adding",
  waiting_files_selection: "Selecting files",
  queued: "Queued",
  downloading: "Downloading",
  ready: "Ready",
  error: "Error",
  deleted: "Removed",
};

/** Human-readable label for a granular debrid status. */
export function debridStatusLabel(status: DebridItemStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Whether an item is still working toward being downloadable (so the UI shows a
 * spinner/progress rather than a terminal state). `error`/`deleted`/`ready` and
 * the pre-add `saved` state are not active.
 */
export function isActiveDebridStatus(status: DebridItemStatus): boolean {
  return (
    status === "adding" ||
    status === "waiting_files_selection" ||
    status === "queued" ||
    status === "downloading"
  );
}
