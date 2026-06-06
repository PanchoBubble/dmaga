import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createRealDebridOAuthClient,
  persistRealDebridTokens,
} from "@/lib/server/real-debrid/auth-service";
import { RealDebridOAuthError } from "@/lib/server/real-debrid/oauth";

const requestSchema = z.object({
  deviceCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = requestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "deviceCode is required." }, { status: 400 });
  }

  try {
    const authClient = createRealDebridOAuthClient();
    const token = await authClient.exchangeDeviceCode(body.data.deviceCode);
    const account = await persistRealDebridTokens({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    });

    return NextResponse.json({
      linked: true,
      username: account.username,
      accountId: account.accountId,
    });
  } catch (error) {
    if (error instanceof RealDebridOAuthError && error.status === 400) {
      return NextResponse.json(
        {
          linked: false,
          pending: true,
          error: "Waiting for Real-Debrid authorization.",
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete Real-Debrid auth.",
      },
      { status: 500 },
    );
  }
}
