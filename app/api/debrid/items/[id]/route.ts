import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AddedItemActionError,
  updateAddedItemAction,
} from "@/lib/server/real-debrid/added-items";
import { RealDebridApiError } from "@/lib/server/real-debrid/client";
import { RealDebridAuthError } from "@/lib/server/real-debrid/auth-service";

const actionSchema = z.object({
  action: z.enum(["remove_local", "delete_from_debrid", "resolve_links"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const item = await updateAddedItemAction(id, parsed.data.action);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AddedItemActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof RealDebridAuthError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof RealDebridApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Unable to update Added item.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
