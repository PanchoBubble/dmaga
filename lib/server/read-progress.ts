import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { readProgress, readUnits } from "@/lib/db/schema";
import type {
  ContinueReadingItem,
  ProgressResponse,
  ProgressUpsert,
} from "@/lib/progress";

/** Series resume point + per-chapter read map for a series. */
export async function getProgress(seriesKey: string): Promise<ProgressResponse> {
  const [series] = await db
    .select({
      seriesKey: readProgress.seriesKey,
      lastProvider: readProgress.lastProvider,
      lastChapterId: readProgress.lastChapterId,
      lastChapterNumber: readProgress.lastChapterNumber,
      lastPage: readProgress.lastPage,
    })
    .from(readProgress)
    .where(eq(readProgress.seriesKey, seriesKey))
    .limit(1);

  const units = await db
    .select({
      unitKey: readUnits.unitKey,
      completed: readUnits.completed,
      lastPage: readUnits.lastPage,
    })
    .from(readUnits)
    .where(eq(readUnits.seriesKey, seriesKey));

  return {
    series: series ?? null,
    units: Object.fromEntries(
      units.map((u) => [u.unitKey, { unitKey: u.unitKey, completed: u.completed, lastPage: u.lastPage }]),
    ),
  };
}

/**
 * Upserts one chapter's read state and bumps the series-level resume point.
 * Called as the reader scrolls (debounced) and when a chapter completes.
 */
export async function upsertChapterProgress(input: ProgressUpsert): Promise<void> {
  const now = new Date();

  await db
    .insert(readUnits)
    .values({
      seriesKey: input.seriesKey,
      unitKey: input.unitKey,
      provider: input.provider,
      chapterId: input.chapterId,
      number: input.number ?? null,
      completed: input.completed,
      lastPage: input.lastPage,
      pageCount: input.pageCount ?? null,
    })
    .onConflictDoUpdate({
      target: [readUnits.seriesKey, readUnits.unitKey],
      set: {
        provider: input.provider,
        chapterId: input.chapterId,
        number: input.number ?? null,
        completed: input.completed,
        lastPage: input.lastPage,
        pageCount: input.pageCount ?? null,
        updatedAt: now,
      },
    });

  await db
    .insert(readProgress)
    .values({
      seriesKey: input.seriesKey,
      mediaKind: input.mediaKind ?? "manga",
      source: input.source,
      title: input.title,
      coverUrl: input.coverUrl ?? null,
      lastProvider: input.provider,
      lastChapterId: input.chapterId,
      lastChapterNumber: input.number ?? null,
      lastPage: input.lastPage,
    })
    .onConflictDoUpdate({
      target: [readProgress.seriesKey],
      set: {
        source: input.source,
        title: input.title,
        coverUrl: input.coverUrl ?? null,
        lastProvider: input.provider,
        lastChapterId: input.chapterId,
        lastChapterNumber: input.number ?? null,
        lastPage: input.lastPage,
        updatedAt: now,
      },
    });
}

/** Most-recently-read series for the "Continue reading" rail. */
export async function listContinueReading(
  limit = 12,
): Promise<ContinueReadingItem[]> {
  const rows = await db
    .select({
      seriesKey: readProgress.seriesKey,
      source: readProgress.source,
      title: readProgress.title,
      coverUrl: readProgress.coverUrl,
      lastProvider: readProgress.lastProvider,
      lastChapterId: readProgress.lastChapterId,
      lastChapterNumber: readProgress.lastChapterNumber,
      lastPage: readProgress.lastPage,
      updatedAt: readProgress.updatedAt,
    })
    .from(readProgress)
    .orderBy(desc(readProgress.updatedAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

/** Toggles a chapter read/unread from the chapter list (no page tracking). */
export async function setChapterRead(
  input: Pick<
    ProgressUpsert,
    "seriesKey" | "source" | "title" | "coverUrl" | "provider" | "chapterId" | "number" | "unitKey" | "mediaKind"
  > & { completed: boolean },
): Promise<void> {
  await upsertChapterProgress({ ...input, lastPage: 0 });
}
