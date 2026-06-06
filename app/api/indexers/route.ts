import { NextRequest, NextResponse } from "next/server";

import { createIndexerSchema } from "@/app/api/indexers/schema";
import {
  IndexerValidationError,
  createIndexer,
  listIndexers,
} from "@/lib/server/indexers/manage";

export async function GET() {
  try {
    return NextResponse.json({ indexers: await listIndexers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load indexers.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createIndexerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const indexer = await createIndexer(parsed.data);
    return NextResponse.json({ indexer }, { status: 201 });
  } catch (error) {
    if (error instanceof IndexerValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message =
      error instanceof Error ? error.message : "Unable to create indexer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
