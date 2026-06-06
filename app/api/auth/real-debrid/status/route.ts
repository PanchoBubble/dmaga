import { NextResponse } from "next/server";

import { getLatestRealDebridAccount } from "@/lib/server/real-debrid/auth-service";

export async function GET() {
  try {
    const account = await getLatestRealDebridAccount();

    if (!account) {
      return NextResponse.json({ linked: false });
    }

    return NextResponse.json({
      linked: true,
      username: account.username,
      accountId: account.accountId,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      lastAuthenticatedAt: account.lastAuthenticatedAt,
    });
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
