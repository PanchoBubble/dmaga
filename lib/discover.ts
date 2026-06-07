import type { CatalogItem } from "@/lib/metadata";
import type { MangaCatalogItem } from "@/lib/manga";
import type { MyAnimeListAnime } from "@/lib/myanimelist";

export const discoverRowIds = [
  "manga:starter",
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

export type DiscoverMangaRow = {
  id: DiscoverRowId;
  kind: "manga";
  title: string;
  href: string;
  items: MangaCatalogItem[];
};

export type DiscoverRow =
  | DiscoverCatalogRow
  | DiscoverMyAnimeListRow
  | DiscoverMangaRow;
