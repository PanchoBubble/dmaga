import { NextRequest, NextResponse } from "next/server";

import { testIndexerSchema } from "@/app/api/indexers/schema";
import { testIndexerConfig } from "@/lib/server/indexers/manage";

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = testIndexerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    // testIndexerConfig folds connection failures into { ok: false } rather
    // than throwing, so a failed probe still returns 200 with the reason.
    const result = await testIndexerConfig(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to test indexer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
