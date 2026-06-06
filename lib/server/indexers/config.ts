import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { indexers } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/server/crypto/encryption";
import type { IndexerConfig } from "@/lib/server/indexers/types";

type IndexerRow = typeof indexers.$inferSelect;

/** Maps a stored indexer row into a runnable {@link IndexerConfig}, decrypting
 * the API key. Pure aside from decryption, so it stays easy to test. */
export function mapIndexerRow(row: IndexerRow): IndexerConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.baseUrl,
    apiKey: row.encryptedApiKey ? decryptSecret(row.encryptedApiKey) : undefined,
    fetchMode: row.fetchMode,
    enabled: row.enabled,
    categories: row.categories,
    settings: row.settings,
  };
}

export async function loadEnabledIndexerConfigs(): Promise<IndexerConfig[]> {
  const rows = await db.select().from(indexers).where(eq(indexers.enabled, true));
  return rows.map(mapIndexerRow);
}

export async function loadIndexerConfig(id: string): Promise<IndexerConfig | null> {
  const [row] = await db.select().from(indexers).where(eq(indexers.id, id)).limit(1);
  return row ? mapIndexerRow(row) : null;
}
