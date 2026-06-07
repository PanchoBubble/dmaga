import type { CatalogItem } from "@/lib/metadata";
import type { MyAnimeListAnime } from "@/lib/myanimelist";

export const discoverRowIds = [
  "mal:watching",
  "mal:plan_to_watch",
  "catalog:popular-movies",
  "catalog:popular-shows",
  "catalog:new-movies",
  "catalog:new-shows",
] as const;

export type DiscoverRowId = (typeof discoverRowIds)[number];

export type DiscoverCatalogRow = {
  id: DiscoverRowId;
  kind: "catalog";
  title: string;
  href: string;
  items: CatalogItem[];
};

export type DiscoverMyAnimeListRow = {
  id: DiscoverRowId;
  kind: "mal";
  title: string;
  items: MyAnimeListAnime[];
};

export type DiscoverRow = DiscoverCatalogRow | DiscoverMyAnimeListRow;
