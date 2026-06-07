import { NextResponse } from "next/server";

import { getMyAnimeListAuthStatus } from "@/lib/server/myanimelist/auth-service";

export async function GET() {
  try {
    return NextResponse.json(await getMyAnimeListAuthStatus());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read MyAnimeList auth status.",
      },
      { status: 500 },
    );
  }
}
