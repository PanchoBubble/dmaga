import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { realDebridAccounts } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/server/crypto/encryption";
import { env } from "@/lib/server/env";
import { RealDebridClient } from "@/lib/server/real-debrid/client";
import { RealDebridOAuthClient } from "@/lib/server/real-debrid/oauth";

const publicRealDebridClientId = "X245A4XAIBGVM";
const tokenRefreshSkewMs = 60_000;

type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export class RealDebridAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealDebridAuthError";
  }
}

export function createRealDebridOAuthClient() {
  return new RealDebridOAuthClient({
    clientId: env.REAL_DEBRID_CLIENT_ID ?? publicRealDebridClientId,
    clientSecret: env.REAL_DEBRID_CLIENT_SECRET,
  });
}

export function shouldCreateDeviceCredentials() {
  return !env.REAL_DEBRID_CLIENT_SECRET;
}

export async function getLatestRealDebridAccount() {
  const [account] = await db
    .select()
    .from(realDebridAccounts)
    .orderBy(desc(realDebridAccounts.updatedAt))
    .limit(1);

  return account;
}

export async function getRealDebridAuthStatus() {
  const account = await getLatestRealDebridAccount();

  if (!account) {
    return { linked: false as const };
  }

  return {
    linked: true as const,
    username: account.username,
    accountId: account.accountId,
    accessTokenExpiresAt: account.accessTokenExpiresAt?.toISOString() ?? null,
    lastAuthenticatedAt: account.lastAuthenticatedAt?.toISOString() ?? null,
    needsRefresh: isTokenExpiring(account.accessTokenExpiresAt),
  };
}

export async function persistRealDebridTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  oauthCredentials?: OAuthCredentials;
}) {
  const client = new RealDebridClient({ accessToken: input.accessToken });
  const user = await client.getUser();
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000);
  const encryptedAccessToken = encryptSecret(input.accessToken);
  const encryptedRefreshToken = encryptSecret(input.refreshToken);
  const encryptedOAuthClientId = input.oauthCredentials
    ? encryptSecret(input.oauthCredentials.clientId)
    : null;
  const encryptedOAuthClientSecret = input.oauthCredentials
    ? encryptSecret(input.oauthCredentials.clientSecret)
    : null;

  const values = {
    accountId: String(user.id),
    username: user.username,
    email: user.email,
    encryptedAccessToken,
    encryptedRefreshToken,
    encryptedOAuthClientId,
    encryptedOAuthClientSecret,
    accessTokenExpiresAt: expiresAt,
    lastAuthenticatedAt: new Date(),
    updatedAt: new Date(),
  };

  const [existingAccount] = await db
    .select()
    .from(realDebridAccounts)
    .where(eq(realDebridAccounts.accountId, values.accountId))
    .limit(1);

  if (existingAccount) {
    const [account] = await db
      .update(realDebridAccounts)
      .set(values)
      .where(eq(realDebridAccounts.id, existingAccount.id))
      .returning();

    return account;
  }

  const [account] = await db.insert(realDebridAccounts).values(values).returning();

  return account;
}

export async function createAuthenticatedRealDebridClient() {
  const accessToken = await getFreshRealDebridAccessToken();

  return new RealDebridClient({ accessToken });
}

export async function getFreshRealDebridAccessToken() {
  const account = await getLatestRealDebridAccount();

  if (!account?.encryptedAccessToken || !account.encryptedRefreshToken) {
    throw new RealDebridAuthError("Real-Debrid is not linked yet.");
  }

  if (!isTokenExpiring(account.accessTokenExpiresAt)) {
    return decryptSecret(account.encryptedAccessToken);
  }

  const authClient = createRealDebridOAuthClient();
  const oauthCredentials = getStoredOAuthCredentials(account);
  const token = await authClient.refreshAccessToken(
    decryptSecret(account.encryptedRefreshToken),
    oauthCredentials,
  );
  const [updatedAccount] = await db
    .update(realDebridAccounts)
    .set({
      encryptedAccessToken: encryptSecret(token.access_token),
      encryptedRefreshToken: encryptSecret(token.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(realDebridAccounts.id, account.id))
    .returning();

  if (!updatedAccount.encryptedAccessToken) {
    throw new RealDebridAuthError("Real-Debrid token refresh did not persist.");
  }

  return decryptSecret(updatedAccount.encryptedAccessToken);
}

export async function exchangeRealDebridDeviceCode(deviceCode: string) {
  const authClient = createRealDebridOAuthClient();
  const oauthCredentials = shouldCreateDeviceCredentials()
    ? await getAuthorizedDeviceCredentials(authClient, deviceCode)
    : undefined;
  const token = await authClient.exchangeDeviceCode(deviceCode, oauthCredentials);

  return persistRealDebridTokens({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    oauthCredentials,
  });
}

async function getAuthorizedDeviceCredentials(
  authClient: RealDebridOAuthClient,
  deviceCode: string,
) {
  const credentials = await authClient.getDeviceCredentials(deviceCode);

  return {
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret,
  };
}

function getStoredOAuthCredentials(account: {
  encryptedOAuthClientId: string | null;
  encryptedOAuthClientSecret: string | null;
}) {
  if (env.REAL_DEBRID_CLIENT_ID && env.REAL_DEBRID_CLIENT_SECRET) {
    return {
      clientId: env.REAL_DEBRID_CLIENT_ID,
      clientSecret: env.REAL_DEBRID_CLIENT_SECRET,
    };
  }

  if (!account.encryptedOAuthClientId || !account.encryptedOAuthClientSecret) {
    throw new RealDebridAuthError("Real-Debrid OAuth credentials are missing.");
  }

  return {
    clientId: decryptSecret(account.encryptedOAuthClientId),
    clientSecret: decryptSecret(account.encryptedOAuthClientSecret),
  };
}

function isTokenExpiring(expiresAt: Date | null) {
  if (!expiresAt) {
    return true;
  }

  return expiresAt.getTime() <= Date.now() + tokenRefreshSkewMs;
}
