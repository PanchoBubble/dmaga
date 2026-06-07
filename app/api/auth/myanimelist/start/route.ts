import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { getMyAnimeListOAuthConfig } from "@/lib/server/myanimelist/auth-service";
import { buildMyAnimeListAuthorizeUrl } from "@/lib/server/myanimelist/client";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export async function POST() {
  const config = getMyAnimeListOAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Set MYANIMELIST_CLIENT_ID before linking MyAnimeList." },
      { status: 400 },
    );
  }

  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const authorizationUrl = buildMyAnimeListAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    codeChallenge: codeVerifier,
    state,
  });

  const response = NextResponse.json({ authorizationUrl });
  response.cookies.set("mal_oauth_state", state, cookieOptions);
  response.cookies.set("mal_oauth_verifier", codeVerifier, cookieOptions);

  return response;
}
