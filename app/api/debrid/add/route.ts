import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  addSearchResultToDebrid,
  AddToDebridError,
} from "@/lib/server/real-debrid/add";
import { RealDebridApiError } from "@/lib/server/real-debrid/client";
import { RealDebridAuthError } from "@/lib/server/real-debrid/auth-service";

const addRequestSchema = z
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
  })
  .refine((value) => Boolean(value.magnetUrl || value.infoHash || value.sourceUrl), {
    message: "A magnet link, info hash, or torrent source URL is required.",
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
    const result = await addSearchResultToDebrid(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RealDebridAuthError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RealDebridApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof AddToDebridError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to add to Real-Debrid.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
