import { NextResponse } from "next/server";

import { getRealDebridAuthStatus } from "@/lib/server/real-debrid/auth-service";

export async function GET() {
  try {
    return NextResponse.json(await getRealDebridAuthStatus());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Real-Debrid auth status.",
      },
      { status: 500 },
    );
  }
}
