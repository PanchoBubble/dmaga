import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setViewedTitle } from "@/lib/server/viewed-titles";

const viewedSchema = z.object({
  catalogType: z.enum(["movie", "series"]),
  catalogId: z.string().min(1),
  title: z.string().min(1),
  myAnimeListUrl: z.string().url().optional(),
  viewed: z.boolean(),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = viewedSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const result = await setViewedTitle(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update viewed state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
