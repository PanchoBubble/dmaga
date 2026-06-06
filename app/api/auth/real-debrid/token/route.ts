import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { exchangeRealDebridDeviceCode } from "@/lib/server/real-debrid/auth-service";
import { RealDebridOAuthError } from "@/lib/server/real-debrid/oauth";

const requestSchema = z.object({
  deviceCode: z.string().min(1),
});

/**
 * While the user hasn't authorized the device yet, Real-Debrid answers the
 * credentials poll with 400 (`authorization_pending`) or 403 carrying an empty
 * error payload. A populated error string (e.g. `permission_denied`,
 * `wrong_parameter`) is a real failure and must surface.
 */
function isAuthorizationPending(error: RealDebridOAuthError) {
  if (error.status === 400) {
    return true;
  }

  return error.status === 403 && !error.payload?.error;
}

export async function POST(request: NextRequest) {
  const body = requestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "deviceCode is required." }, { status: 400 });
  }

  try {
    const account = await exchangeRealDebridDeviceCode(body.data.deviceCode);

    return NextResponse.json({
      linked: true,
      username: account.username,
      accountId: account.accountId,
    });
  } catch (error) {
    if (error instanceof RealDebridOAuthError && isAuthorizationPending(error)) {
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
