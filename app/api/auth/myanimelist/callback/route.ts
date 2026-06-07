import { NextRequest, NextResponse } from "next/server";

import {
  getMyAnimeListOAuthConfig,
  persistMyAnimeListTokens,
} from "@/lib/server/myanimelist/auth-service";
import { exchangeMyAnimeListCode } from "@/lib/server/myanimelist/client";

export async function GET(request: NextRequest) {
  const config = getMyAnimeListOAuthConfig();
  const settingsUrl = new URL("/settings", request.url);

  if (!config) {
    settingsUrl.searchParams.set("mal", "missing-config");
    return NextResponse.redirect(settingsUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("mal_oauth_state")?.value;
  const codeVerifier = request.cookies.get("mal_oauth_verifier")?.value;

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    settingsUrl.searchParams.set("mal", "invalid-state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const token = await exchangeMyAnimeListCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
      codeVerifier,
    });

    await persistMyAnimeListTokens({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    });

    settingsUrl.searchParams.set("mal", "linked");
  } catch {
    settingsUrl.searchParams.set("mal", "error");
  }

  const response = NextResponse.redirect(settingsUrl);
  response.cookies.delete("mal_oauth_state");
  response.cookies.delete("mal_oauth_verifier");

  return response;
}
