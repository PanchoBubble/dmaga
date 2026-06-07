import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { myAnimeListDiscoverPreferences } from "@/lib/db/schema";
import type { MyAnimeListStatus } from "@/lib/myanimelist";
import { getLatestMyAnimeListAccount } from "@/lib/server/myanimelist/auth-service";

export const visibleMyAnimeListStatuses = [
  { id: "watching", label: "MAL - Watching" },
  { id: "plan_to_watch", label: "MAL - Want to Watch" },
] as const satisfies Array<{ id: MyAnimeListStatus; label: string }>;

const defaultOrder = visibleMyAnimeListStatuses.map((status) => status.id);

export async function getMyAnimeListDiscoverOrder(): Promise<MyAnimeListStatus[]> {
  const preferenceKey = await getPreferenceKey();
  const [row] = await db
    .select({ rowOrder: myAnimeListDiscoverPreferences.rowOrder })
    .from(myAnimeListDiscoverPreferences)
    .where(eq(myAnimeListDiscoverPreferences.preferenceKey, preferenceKey))
    .limit(1);

  return sanitizeOrder(row?.rowOrder);
}

export async function setMyAnimeListDiscoverOrder(
  rowOrder: string[],
): Promise<MyAnimeListStatus[]> {
  const preferenceKey = await getPreferenceKey();
  const sanitized = sanitizeOrder(rowOrder);

  await db
    .insert(myAnimeListDiscoverPreferences)
    .values({
      preferenceKey,
      rowOrder: sanitized,
    })
    .onConflictDoUpdate({
      target: myAnimeListDiscoverPreferences.preferenceKey,
      set: {
        rowOrder: sanitized,
        updatedAt: new Date(),
      },
    });

  return sanitized;
}

async function getPreferenceKey() {
  const account = await getLatestMyAnimeListAccount();
  return account?.accountId ? `mal:${account.accountId}` : "mal:default";
}

function sanitizeOrder(rowOrder: string[] | undefined): MyAnimeListStatus[] {
  const allowed = new Set<MyAnimeListStatus>(defaultOrder);
  const next = (rowOrder ?? []).filter((status): status is MyAnimeListStatus =>
    allowed.has(status as MyAnimeListStatus),
  );

  for (const status of defaultOrder) {
    if (!next.includes(status)) {
      next.push(status);
    }
  }

  return next;
}
