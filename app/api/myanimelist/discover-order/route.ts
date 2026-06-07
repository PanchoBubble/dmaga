import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getMyAnimeListDiscoverOrder,
  setMyAnimeListDiscoverOrder,
} from "@/lib/server/myanimelist/discover-preferences";

const orderSchema = z.object({
  rowOrder: z.array(z.enum(["watching", "plan_to_watch"])),
});

export async function GET() {
  try {
    return NextResponse.json({ rowOrder: await getMyAnimeListDiscoverOrder() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read MyAnimeList row order.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      rowOrder: await setMyAnimeListDiscoverOrder(parsed.data.rowOrder),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update MyAnimeList row order.",
      },
      { status: 500 },
    );
  }
}
