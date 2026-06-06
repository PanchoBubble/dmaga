import { NextResponse } from "next/server";

import { getPlayableLink, PlaybackError } from "@/lib/server/real-debrid/playback";

type RouteContext = { params: Promise<{ id: string }> };

// Resolves a fresh, directly-streamable URL on demand (e.g. when a stored link
// has expired), so the player should always read current state.
export const dynamic = "force-dynamic";

/**
 * Returns the resolved playable link for a debrid link id. Pass `?refresh=1` to
 * force a fresh Real-Debrid unrestrict, e.g. after the previous URL expired.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    const link = await getPlayableLink(id, { refresh });
    return NextResponse.json({ link });
  } catch (error) {
    if (error instanceof PlaybackError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Unable to resolve playable link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
