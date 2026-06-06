import { NextRequest, NextResponse } from "next/server";

import { updateIndexerSchema } from "@/app/api/indexers/schema";
import {
  IndexerValidationError,
  deleteIndexer,
  updateIndexer,
} from "@/lib/server/indexers/manage";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateIndexerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const indexer = await updateIndexer(id, parsed.data);
    return NextResponse.json({ indexer });
  } catch (error) {
    if (error instanceof IndexerValidationError) {
      const status = error.message === "Indexer not found." ? 404 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    const message =
      error instanceof Error ? error.message : "Unable to update indexer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  try {
    const deleted = await deleteIndexer(id);
    if (!deleted) {
      return NextResponse.json({ error: "Indexer not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete indexer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
