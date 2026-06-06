import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { realDebridAccounts } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/server/crypto/encryption";
import { env } from "@/lib/server/env";
import { RealDebridClient } from "@/lib/server/real-debrid/client";
import { RealDebridOAuthClient } from "@/lib/server/real-debrid/oauth";

export function createRealDebridOAuthClient() {
  if (!env.REAL_DEBRID_CLIENT_ID) {
    throw new Error("REAL_DEBRID_CLIENT_ID is required for Real-Debrid auth.");
  }

  return new RealDebridOAuthClient({
    clientId: env.REAL_DEBRID_CLIENT_ID,
    clientSecret: env.REAL_DEBRID_CLIENT_SECRET,
  });
}

export async function getLatestRealDebridAccount() {
  const [account] = await db
    .select()
    .from(realDebridAccounts)
    .orderBy(desc(realDebridAccounts.updatedAt))
    .limit(1);

  return account;
}

export async function persistRealDebridTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const client = new RealDebridClient({ accessToken: input.accessToken });
  const user = await client.getUser();
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

  const [account] = await db
    .insert(realDebridAccounts)
    .values({
      accountId: String(user.id),
      username: user.username,
      email: user.email,
      encryptedAccessToken: encryptSecret(input.accessToken),
      encryptedRefreshToken: encryptSecret(input.refreshToken),
      accessTokenExpiresAt: expiresAt,
      lastAuthenticatedAt: new Date(),
    })
    .returning();

  return account;
}
