/** Fields the client sends to star (favorite) or unstar a search result. */
export type SetSavedRequest = {
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
  /** Desired saved state: true to star, false to unstar. */
  saved: boolean;
};

/** Result of a save toggle, used to reconcile the optimistic client state. */
export type SetSavedResponse = {
  mediaItemId: string;
  saved: boolean;
};
