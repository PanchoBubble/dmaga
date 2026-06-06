import { NextResponse } from "next/server";

import {
  createRealDebridOAuthClient,
  shouldCreateDeviceCredentials,
} from "@/lib/server/real-debrid/auth-service";

export async function POST() {
  try {
    const authClient = createRealDebridOAuthClient();
    const deviceCode = await authClient.createDeviceCode({
      newCredentials: shouldCreateDeviceCredentials(),
    });

    return NextResponse.json(deviceCode);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start auth." },
      { status: 500 },
    );
  }
}
