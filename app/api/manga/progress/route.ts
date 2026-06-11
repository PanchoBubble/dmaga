import { NextRequest, NextResponse } from "next/server";

import type { ProgressUpsert } from "@/lib/progress";
import {
  getProgress,
  listContinueReading,
  upsertChapterProgress,
} from "@/lib/server/read-progress";

export const dynamic = "force-dynamic";

/**
 * GET ?seriesKey=… → that series' resume point + per-chapter read map.
 * GET ?continue=1 → the "Continue reading" rail (recent series).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.get("continue")) {
    const limit = Math.min(48, Math.max(1, Number(params.get("limit")) || 12));
    return NextResponse.json({ items: await listContinueReading(limit) });
  }

  const seriesKey = params.get("seriesKey")?.trim();
  if (!seriesKey) {
    return NextResponse.json({ error: "seriesKey is required." }, { status: 400 });
  }
  return NextResponse.json(await getProgress(seriesKey));
}

/** POST → upsert one chapter's read state (mark read / save resume page). */
export async function POST(request: NextRequest) {
  let body: ProgressUpsert;
  try {
    body = (await request.json()) as ProgressUpsert;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.seriesKey || !body.unitKey || !body.provider || !body.chapterId) {
    return NextResponse.json(
      { error: "seriesKey, unitKey, provider and chapterId are required." },
      { status: 400 },
    );
  }

  try {
    await upsertChapterProgress({
      ...body,
      lastPage: Math.max(0, Number(body.lastPage) || 0),
      completed: Boolean(body.completed),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save progress.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
