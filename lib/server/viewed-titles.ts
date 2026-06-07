import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { viewedTitles } from "@/lib/db/schema";
import type { CatalogType } from "@/lib/metadata";
import type { ViewedTitleRequest, ViewedTitleResponse } from "@/lib/viewed";

export async function getViewedTitle(input: {
  catalogType: CatalogType;
  catalogId: string;
}): Promise<ViewedTitleResponse> {
  const [row] = await db
    .select({
      catalogType: viewedTitles.catalogType,
      catalogId: viewedTitles.catalogId,
      viewed: viewedTitles.viewed,
      viewedAt: viewedTitles.viewedAt,
    })
    .from(viewedTitles)
    .where(
      and(
        eq(viewedTitles.catalogType, input.catalogType),
        eq(viewedTitles.catalogId, input.catalogId),
      ),
    )
    .limit(1);

  return {
    catalogType: input.catalogType,
    catalogId: input.catalogId,
    viewed: row?.viewed ?? false,
    viewedAt: row?.viewedAt?.toISOString() ?? null,
  };
}

export async function setViewedTitle(
  input: ViewedTitleRequest,
): Promise<ViewedTitleResponse> {
  const viewedAt = input.viewed ? new Date() : null;

  const [row] = await db
    .insert(viewedTitles)
    .values({
      catalogType: input.catalogType,
      catalogId: input.catalogId,
      title: input.title,
      myAnimeListUrl: input.myAnimeListUrl,
      viewed: input.viewed,
      viewedAt,
    })
    .onConflictDoUpdate({
      target: [viewedTitles.catalogType, viewedTitles.catalogId],
      set: {
        title: input.title,
        myAnimeListUrl: input.myAnimeListUrl,
        viewed: input.viewed,
        viewedAt,
        updatedAt: new Date(),
      },
    })
    .returning({
      catalogType: viewedTitles.catalogType,
      catalogId: viewedTitles.catalogId,
      viewed: viewedTitles.viewed,
      viewedAt: viewedTitles.viewedAt,
    });

  return {
    catalogType: row.catalogType as CatalogType,
    catalogId: row.catalogId,
    viewed: row.viewed,
    viewedAt: row.viewedAt?.toISOString() ?? null,
  };
}
