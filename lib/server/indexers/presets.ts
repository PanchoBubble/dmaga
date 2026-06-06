import type { IndexerFetchMode, IndexerInput, IndexerType } from "@/lib/indexers";
import { prowlarrPublicIndexerPresets } from "@/lib/server/indexers/prowlarr-public-presets";

export type IndexerPreset = Omit<IndexerInput, "apiKey"> & {
  presetKey: string;
  description: string;
  requiresApiKey: boolean;
  settings?: Record<string, unknown>;
};

const defaultCategories = ["2000", "5000"];

const utilityIndexerPresets = [
  {
    presetKey: "jackett-all",
    name: "Jackett - All",
    type: "torznab",
    baseUrl: "http://jackett:9117/api/v2.0/indexers/all/results/torznab/",
    fetchMode: "direct",
    enabled: false,
    categories: defaultCategories,
    description: "Jackett aggregate Torznab endpoint for every configured tracker.",
    requiresApiKey: true,
  },
  {
    presetKey: "prowlarr-torznab",
    name: "Prowlarr Torznab",
    type: "torznab",
    baseUrl: "http://prowlarr:9696/api/v1/indexer/1/results/torznab/api",
    fetchMode: "direct",
    enabled: false,
    categories: defaultCategories,
    description: "Prowlarr Torznab endpoint; edit the indexer id/path after setup.",
    requiresApiKey: true,
  },
  {
    presetKey: "generic-torznab",
    name: "Generic Torznab",
    type: "torznab",
    baseUrl: "https://example.com/api",
    fetchMode: "direct",
    enabled: false,
    categories: defaultCategories,
    description: "Reusable template for any Torznab-compatible torrent indexer.",
    requiresApiKey: false,
  },
  {
    presetKey: "cloudflare-torznab",
    name: "Cloudflare Torznab",
    type: "torznab",
    baseUrl: "https://example.com/api",
    fetchMode: "flaresolverr",
    enabled: false,
    categories: defaultCategories,
    description:
      "Template for Torznab indexers that need FlareSolverr challenge handling.",
    requiresApiKey: false,
  },
] satisfies Array<IndexerPreset & { type: IndexerType; fetchMode: IndexerFetchMode }>;

export const defaultIndexerPresets = [
  ...utilityIndexerPresets,
  ...prowlarrPublicIndexerPresets,
] satisfies Array<IndexerPreset & { type: IndexerType; fetchMode: IndexerFetchMode }>;
