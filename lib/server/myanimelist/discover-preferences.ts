import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { myAnimeListDiscoverPreferences } from "@/lib/db/schema";
import { discoverRowIds, type DiscoverRowId } from "@/lib/discover";
import type { MyAnimeListStatus } from "@/lib/myanimelist";
import { getLatestMyAnimeListAccount } from "@/lib/server/myanimelist/auth-service";

export const visibleMyAnimeListStatuses = [
  { id: "watching", label: "MAL - Watching" },
  { id: "plan_to_watch", label: "MAL - Want to Watch" },
] as const satisfies Array<{ id: MyAnimeListStatus; label: string }>;

const defaultDiscoverOrder = [...discoverRowIds];

export async function getDiscoverRowOrder(): Promise<DiscoverRowId[]> {
  const preferenceKey = await getPreferenceKey();
  const [row] = await db
    .select({ rowOrder: myAnimeListDiscoverPreferences.rowOrder })
    .from(myAnimeListDiscoverPreferences)
    .where(eq(myAnimeListDiscoverPreferences.preferenceKey, preferenceKey))
    .limit(1);

  return sanitizeDiscoverOrder(row?.rowOrder);
}

export async function setDiscoverRowOrder(
  rowOrder: string[],
): Promise<DiscoverRowId[]> {
  const preferenceKey = await getPreferenceKey();
  const sanitized = sanitizeDiscoverOrder(rowOrder);

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

function sanitizeDiscoverOrder(rowOrder: string[] | undefined): DiscoverRowId[] {
  const allowed = new Set<DiscoverRowId>(defaultDiscoverOrder);
  const next = (rowOrder ?? []).filter((rowId): rowId is DiscoverRowId =>
    allowed.has(rowId as DiscoverRowId),
  );

  for (const rowId of defaultDiscoverOrder) {
    if (!next.includes(rowId)) {
      next.push(rowId);
    }
  }

  return next;
}
