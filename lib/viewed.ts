import type { CatalogType } from "@/lib/metadata";

export type ViewedTitleRequest = {
  catalogType: CatalogType;
  catalogId: string;
  title: string;
  myAnimeListUrl?: string;
  viewed: boolean;
};

export type ViewedTitleResponse = {
  catalogType: CatalogType;
  catalogId: string;
  viewed: boolean;
  viewedAt: string | null;
};
