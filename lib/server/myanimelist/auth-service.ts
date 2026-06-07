import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { myAnimeListAccounts } from "@/lib/db/schema";
import type { MyAnimeListStatus } from "@/lib/myanimelist";
import { decryptSecret, encryptSecret } from "@/lib/server/crypto/encryption";
import { env } from "@/lib/server/env";
import {
  MyAnimeListClient,
  refreshMyAnimeListToken,
} from "@/lib/server/myanimelist/client";

const tokenRefreshSkewMs = 60_000;

export class MyAnimeListAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MyAnimeListAuthError";
  }
}

export function getMyAnimeListOAuthConfig() {
  if (!env.MYANIMELIST_CLIENT_ID) {
    return null;
  }

  return {
    clientId: env.MYANIMELIST_CLIENT_ID,
    clientSecret: env.MYANIMELIST_CLIENT_SECRET,
    redirectUri: new URL(
      "/api/auth/myanimelist/callback",
      env.NEXT_PUBLIC_APP_URL,
    ).toString(),
  };
}

export async function getLatestMyAnimeListAccount() {
  const [account] = await db
    .select()
    .from(myAnimeListAccounts)
    .orderBy(desc(myAnimeListAccounts.updatedAt))
    .limit(1);

  return account;
}

export async function getMyAnimeListAuthStatus() {
  const configured = Boolean(getMyAnimeListOAuthConfig());
  const account = await getLatestMyAnimeListAccount();

  if (!account) {
    return { linked: false as const, configured };
  }

  return {
    linked: true as const,
    configured,
    username: account.username,
    accountId: account.accountId,
    accessTokenExpiresAt: account.accessTokenExpiresAt?.toISOString() ?? null,
    lastAuthenticatedAt: account.lastAuthenticatedAt?.toISOString() ?? null,
    needsRefresh: isTokenExpiring(account.accessTokenExpiresAt),
  };
}

export async function persistMyAnimeListTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const client = new MyAnimeListClient(input.accessToken);
  const viewer = await client.getViewer();
  const accountId = viewer.id ? String(viewer.id) : null;
  const values = {
    accountId,
    username: viewer.name,
    encryptedAccessToken: encryptSecret(input.accessToken),
    encryptedRefreshToken: encryptSecret(input.refreshToken),
    accessTokenExpiresAt: new Date(Date.now() + input.expiresIn * 1000),
    lastAuthenticatedAt: new Date(),
    updatedAt: new Date(),
  };

  const [existing] = accountId
    ? await db
        .select()
        .from(myAnimeListAccounts)
        .where(eq(myAnimeListAccounts.accountId, accountId))
        .limit(1)
    : [];

  if (existing) {
    const [account] = await db
      .update(myAnimeListAccounts)
      .set(values)
      .where(eq(myAnimeListAccounts.id, existing.id))
      .returning();

    return account;
  }

  const [account] = await db.insert(myAnimeListAccounts).values(values).returning();

  return account;
}

export async function createAuthenticatedMyAnimeListClient() {
  return new MyAnimeListClient(await getFreshMyAnimeListAccessToken());
}

export async function getFreshMyAnimeListAccessToken() {
  const account = await getLatestMyAnimeListAccount();

  if (!account?.encryptedAccessToken || !account.encryptedRefreshToken) {
    throw new MyAnimeListAuthError("MyAnimeList is not linked yet.");
  }

  if (!isTokenExpiring(account.accessTokenExpiresAt)) {
    return decryptSecret(account.encryptedAccessToken);
  }

  const config = getMyAnimeListOAuthConfig();
  if (!config) {
    throw new MyAnimeListAuthError("MyAnimeList OAuth credentials are missing.");
  }

  const token = await refreshMyAnimeListToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: decryptSecret(account.encryptedRefreshToken),
  });
  const [updated] = await db
    .update(myAnimeListAccounts)
    .set({
      encryptedAccessToken: encryptSecret(token.access_token),
      encryptedRefreshToken: encryptSecret(token.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(myAnimeListAccounts.id, account.id))
    .returning();

  if (!updated.encryptedAccessToken) {
    throw new MyAnimeListAuthError("MyAnimeList token refresh did not persist.");
  }

  return decryptSecret(updated.encryptedAccessToken);
}

export async function listMyAnimeListAnime(status: MyAnimeListStatus, limit?: number) {
  const client = await createAuthenticatedMyAnimeListClient();
  return client.getAnimeList(status, limit);
}

function isTokenExpiring(expiresAt: Date | null) {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() <= Date.now() + tokenRefreshSkewMs;
}
