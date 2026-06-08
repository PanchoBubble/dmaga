import type { IndexerFetchMode, IndexerInput, IndexerType } from "@/lib/indexers";
import { prowlarrPublicIndexerPresets } from "@/lib/server/indexers/prowlarr-public-presets";

export type IndexerPreset = Omit<IndexerInput, "apiKey"> & {
  presetKey: string;
  description: string;
  requiresApiKey: boolean;
  settings?: Record<string, unknown>;
};

const utilityIndexerPresets = [
  {
    presetKey: "jackett-all",
    name: "Jackett - All",
    type: "torznab",
    baseUrl: "http://jackett:9117/api/v2.0/indexers/all/results/torznab/",
    fetchMode: "direct",
    enabled: false,
    categories: ["7030"],
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
    categories: ["7030"],
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
    categories: ["7030"],
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
    categories: ["7030"],
    description:
      "Template for Torznab indexers that need FlareSolverr challenge handling.",
    requiresApiKey: false,
  },
  {
    presetKey: "torrentio",
    name: "Torrentio",
    type: "torrentio",
    baseUrl: "https://torrentio.strem.fun/",
    fetchMode: "direct",
    enabled: false,
    categories: [],
    description:
      "Torrentio aggregates many torrent sources by IMDB id (resolved from your query via Cinemeta). Use SxxExx in the query for TV episodes.",
    requiresApiKey: false,
  },
  {
    presetKey: "internet-archive",
    name: "Internet Archive",
    type: "internet_archive",
    baseUrl: "https://archive.org/",
    fetchMode: "direct",
    enabled: false,
    categories: [],
    description:
      "Public Archive.org search using generated item torrent files when available.",
    requiresApiKey: false,
  },
  {
    presetKey: "minerva-archive",
    name: "MiNERVA Archive",
    type: "minerva",
    baseUrl: "https://minerva-archive.org/",
    fetchMode: "direct",
    enabled: false,
    categories: [],
    description:
      "Searches MiNERVA's public Myrient path index and links results to their ROM pages.",
    requiresApiKey: false,
  },
] satisfies Array<IndexerPreset & { type: IndexerType; fetchMode: IndexerFetchMode }>;

const animeIndexerPresets = [
  {
    presetKey: "anime-nyaa-si",
    name: "Manga - Nyaa.si",
    type: "cardigann",
    baseUrl: "https://nyaa.si/",
    fetchMode: "direct",
    enabled: false,
    categories: ["3_0"],
    description: "Manga-focused Nyaa.si preset using category 3_0.",
    requiresApiKey: false,
  },
  {
    presetKey: "anime-acg-rip",
    name: "Anime - ACG.RIP",
    type: "cardigann",
    baseUrl: "https://acg.rip/",
    fetchMode: "direct",
    enabled: false,
    categories: [],
    description:
      "Anime and Japanese media releases from ACG.RIP, useful for current seasonal shows.",
    requiresApiKey: false,
  },
  {
    presetKey: "anime-tokyo-toshokan",
    name: "Manga - Tokyo Toshokan",
    type: "cardigann",
    baseUrl: "https://www.tokyotosho.info/",
    fetchMode: "direct",
    enabled: false,
    categories: ["3"],
    description: "Japanese media tracker manga preset using category 3.",
    requiresApiKey: false,
  },
  {
    presetKey: "anime-shana-project",
    name: "Anime - Shana Project",
    type: "cardigann",
    baseUrl: "https://www.shanaproject.com/",
    fetchMode: "direct",
    enabled: false,
    categories: ["Anime"],
    description: "Anime release tracker for following shows and fansub releases.",
    requiresApiKey: false,
  },
] satisfies Array<IndexerPreset & { type: IndexerType; fetchMode: IndexerFetchMode }>;

export const defaultIndexerPresets = [
  ...utilityIndexerPresets,
  ...animeIndexerPresets,
  ...prowlarrPublicIndexerPresets,
] satisfies Array<IndexerPreset & { type: IndexerType; fetchMode: IndexerFetchMode }>;
