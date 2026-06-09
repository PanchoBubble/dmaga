import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addDirectSource, AddDirectError } from "@/lib/server/direct/add";

const addRequestSchema = z.object({
  title: z.string().min(1),
  previewImageUrl: z.string().url().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  seeders: z.number().nonnegative().optional(),
  leechers: z.number().nonnegative().optional(),
  publishedAt: z.string().optional(),
  indexerId: z.string().optional(),
  indexerName: z.string().min(1),
  sourceUrl: z.string().optional(),
  directSource: z.object({
    kind: z.literal("internet_archive"),
    identifier: z.string().min(1),
  }),
  originSection: z.enum(["movie", "show", "mal", "manga", "other"]).optional(),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = addRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const result = await addDirectSource(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AddDirectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to add direct source.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
