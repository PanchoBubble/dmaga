import type {
  IndexerAdapter,
  IndexerConfig,
  TorrentSearchParams,
  TorrentSearchResult,
} from "@/lib/server/indexers/types";

export class TorznabIndexerAdapter implements IndexerAdapter {
  async search(
    config: IndexerConfig,
    params: TorrentSearchParams,
  ): Promise<TorrentSearchResult[]> {
    const url = new URL(config.baseUrl);
    url.searchParams.set("t", "search");
    url.searchParams.set("q", params.query);

    if (config.apiKey) {
      url.searchParams.set("apikey", config.apiKey);
    }

    if (params.categories?.length) {
      url.searchParams.set("cat", params.categories.join(","));
    }

    throw new Error(`Torznab parsing is not implemented yet for ${url.toString()}`);
  }
}
