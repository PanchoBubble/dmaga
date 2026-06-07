import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setSavedState } from "@/lib/server/saved-items";

const setSavedSchema = z
  .object({
    title: z.string().min(1),
    infoHash: z.string().min(1).optional(),
    magnetUrl: z.string().min(1).optional(),
    sizeBytes: z.number().nonnegative().optional(),
    seeders: z.number().nonnegative().optional(),
    leechers: z.number().nonnegative().optional(),
    publishedAt: z.string().optional(),
    indexerId: z.string().optional(),
    indexerName: z.string().min(1),
    sourceUrl: z.string().optional(),
    saved: z.boolean(),
  })
  .refine((value) => Boolean(value.magnetUrl || value.infoHash || value.sourceUrl), {
    message: "A magnet link, info hash, or source URL is required.",
  });

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = setSavedSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const result = await setSavedState(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update saved state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
