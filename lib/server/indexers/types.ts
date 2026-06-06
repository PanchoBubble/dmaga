export type IndexerFetchMode = "direct" | "flaresolverr";

export type IndexerConfig = {
  id: string;
  name: string;
  type: "torznab";
  baseUrl: string;
  apiKey?: string;
  fetchMode: IndexerFetchMode;
  enabled: boolean;
};

export type TorrentSearchResult = {
  id: string;
  title: string;
  sizeBytes?: number;
  seeders?: number;
  leechers?: number;
  publishedAt?: string;
  indexerId: string;
  indexerName: string;
  magnetUrl?: string;
  infoHash?: string;
  sourceUrl?: string;
};

export type TorrentSearchParams = {
  query: string;
  categories?: string[];
};

export interface IndexerAdapter {
  search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]>;
}
