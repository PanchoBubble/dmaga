import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { indexers } from "@/lib/db/schema";
import type { IndexerDto, IndexerInput, IndexerTestResult } from "@/lib/indexers";
import { encryptSecret } from "@/lib/server/crypto/encryption";
import { mapIndexerRow } from "@/lib/server/indexers/config";
import { defaultIndexerPresets } from "@/lib/server/indexers/presets";
import { getIndexerAdapter } from "@/lib/server/indexers/registry";
import { IndexerError, type IndexerConfig } from "@/lib/server/indexers/types";

type IndexerRow = typeof indexers.$inferSelect;

export class IndexerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexerValidationError";
  }
}

/** A config to test: an existing indexer's id, or an ad-hoc unsaved config. */
export type IndexerTestInput = Omit<IndexerInput, "enabled"> & { id?: string };

function toDto(row: IndexerRow): IndexerDto {
  const settings = indexerSettings(row);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.baseUrl,
    hasApiKey: Boolean(row.encryptedApiKey),
    fetchMode: row.fetchMode,
    enabled: row.enabled,
    categories: row.categories,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: row.lastTestStatus,
    presetKey: settings.presetKey ?? null,
    description: settings.description ?? null,
    requiresApiKey: settings.requiresApiKey ?? false,
    hasLoginCredentials: Boolean(
      settings.credentials?.encryptedUsername ||
      settings.credentials?.encryptedPassword,
    ),
  };
}

export async function listIndexers(): Promise<IndexerDto[]> {
  await ensureDefaultIndexers();
  const rows = await db.select().from(indexers).orderBy(desc(indexers.createdAt));
  return rows.map(toDto);
}

export async function createIndexer(input: IndexerInput): Promise<IndexerDto> {
  await assertNameAvailable(input.name);

  const [created] = await db
    .insert(indexers)
    .values({
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl,
      encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : null,
      fetchMode: input.fetchMode,
      enabled: input.enabled,
      categories: input.categories,
      settings: mergeSettings({}, input),
    })
    .returning();

  return toDto(created);
}

/**
 * Applies a partial change to an indexer — used both by the edit form (full
 * payload) and quick enable/disable toggles (just `enabled`). Fields left
 * undefined are untouched; `apiKey` follows the same tri-state as create.
 */
export async function updateIndexer(
  id: string,
  input: Partial<IndexerInput>,
): Promise<IndexerDto> {
  if (input.name !== undefined) {
    await assertNameAvailable(input.name, id);
  }

  const [existing] = await db
    .select({ settings: indexers.settings })
    .from(indexers)
    .where(eq(indexers.id, id))
    .limit(1);

  if (!existing) {
    throw new IndexerValidationError("Indexer not found.");
  }

  const values = {
    ...definedOnly({
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl,
      fetchMode: input.fetchMode,
      enabled: input.enabled,
      categories: input.categories,
    }),
    updatedAt: new Date(),
    // Tri-state: undefined keeps the stored key, empty/null clears it, a value
    // sets a new one.
    ...(input.apiKey === undefined
      ? {}
      : { encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : null }),
    ...(input.username === undefined && input.password === undefined
      ? {}
      : { settings: mergeSettings(existing.settings, input) }),
  };

  const [updated] = await db
    .update(indexers)
    .set(values)
    .where(eq(indexers.id, id))
    .returning();

  if (!updated) {
    throw new IndexerValidationError("Indexer not found.");
  }

  return toDto(updated);
}

/** Drops keys whose value is `undefined` so they don't overwrite stored columns. */
function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export async function deleteIndexer(id: string): Promise<boolean> {
  const deleted = await db
    .delete(indexers)
    .where(eq(indexers.id, id))
    .returning({ id: indexers.id });

  return deleted.length > 0;
}

/**
 * Tests an indexer config (saved or ad-hoc) for reachability + credentials.
 * Never throws on a connection failure — the failure reason is returned in the
 * result so the UI can show it. When an `id` is supplied, the outcome is also
 * persisted to `lastTestedAt`/`lastTestStatus`.
 */
export async function testIndexerConfig(
  input: IndexerTestInput,
): Promise<IndexerTestResult> {
  const savedConfig = input.id ? await loadSavedIndexerConfig(input.id) : null;
  const apiKey = await resolveTestApiKey(input, savedConfig);
  const config: IndexerConfig = {
    id: input.id ?? "unsaved",
    name: input.name,
    type: input.type,
    baseUrl: input.baseUrl,
    apiKey,
    fetchMode: input.fetchMode,
    enabled: true,
    categories: input.categories,
    settings: savedConfig?.settings,
  };

  let result: IndexerTestResult;
  try {
    const outcome = await getIndexerAdapter(config.type).test(config);
    result = { ok: outcome.ok, message: outcome.message };
  } catch (error) {
    result = {
      ok: false,
      message:
        error instanceof IndexerError || error instanceof Error
          ? error.message
          : "Indexer test failed.",
    };
  }

  if (input.id) {
    await db
      .update(indexers)
      .set({
        lastTestedAt: new Date(),
        lastTestStatus: result.ok ? "ok" : result.message,
        updatedAt: new Date(),
      })
      .where(eq(indexers.id, input.id));
  }

  return result;
}

/**
 * Resolves the API key to test with: a freshly-entered key wins; otherwise fall
 * back to the saved (encrypted) key so testing an existing indexer doesn't
 * require re-entering it.
 */
async function resolveTestApiKey(
  input: IndexerTestInput,
  savedConfig: IndexerConfig | null,
): Promise<string | undefined> {
  if (input.apiKey) {
    return input.apiKey;
  }
  if (input.apiKey === null || !input.id) {
    return undefined;
  }

  return savedConfig?.apiKey;
}

async function loadSavedIndexerConfig(id: string): Promise<IndexerConfig | null> {
  const [row] = await db.select().from(indexers).where(eq(indexers.id, id)).limit(1);
  return row ? mapIndexerRow(row) : null;
}

/** Indexer names are unique; surface a friendly error instead of a DB 23505. */
async function assertNameAvailable(name: string, excludeId?: string) {
  const [existing] = await db
    .select({ id: indexers.id })
    .from(indexers)
    .where(eq(indexers.name, name))
    .limit(1);

  if (existing && existing.id !== excludeId) {
    throw new IndexerValidationError(`An indexer named "${name}" already exists.`);
  }
}

async function ensureDefaultIndexers() {
  const rows = await db.select().from(indexers);
  await syncBuiltInPresetMetadata(rows);

  const existingPresetKeys = new Set(
    rows
      .map((row) => indexerSettings(row).presetKey)
      .filter((key): key is string => Boolean(key)),
  );
  const existingNames = new Set(rows.map((row) => row.name));
  const missing = defaultIndexerPresets.filter(
    (preset) => !existingPresetKeys.has(preset.presetKey),
  );

  if (!missing.length) {
    return;
  }

  await db.insert(indexers).values(
    missing.map((preset) => {
      const name = uniquePresetName(preset.name, existingNames);
      existingNames.add(name);

      return {
        name,
        type: preset.type,
        baseUrl: preset.baseUrl,
        encryptedApiKey: null,
        fetchMode: preset.fetchMode,
        enabled: preset.enabled,
        categories: preset.categories,
        settings: {
          ...presetSettings(preset),
          presetKey: preset.presetKey,
          description: preset.description,
          requiresApiKey: preset.requiresApiKey,
        },
      };
    }),
  );
}

async function syncBuiltInPresetMetadata(rows: IndexerRow[]) {
  const presetByKey = new Map(
    defaultIndexerPresets.map((preset) => [preset.presetKey, preset]),
  );

  await Promise.all(
    rows.map(async (row) => {
      const presetKey = indexerSettings(row).presetKey;
      const preset = presetKey ? presetByKey.get(presetKey) : undefined;
      if (!preset) {
        return;
      }

      await db
        .update(indexers)
        .set({
          type: preset.type,
          categories: preset.categories,
          settings: {
            ...row.settings,
            ...presetSettings(preset),
            presetKey: preset.presetKey,
            description: preset.description,
            requiresApiKey: preset.requiresApiKey,
          },
          updatedAt: new Date(),
        })
        .where(eq(indexers.id, row.id));
    }),
  );
}

function presetSettings(preset: (typeof defaultIndexerPresets)[number]) {
  return "settings" in preset && preset.settings ? preset.settings : {};
}

function uniquePresetName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) {
    return name;
  }

  let suffix = 2;
  let candidate = `${name} ${suffix}`;
  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${name} ${suffix}`;
  }
  return candidate;
}

function indexerSettings(row: IndexerRow): {
  presetKey?: string;
  description?: string;
  requiresApiKey?: boolean;
  credentials?: {
    encryptedUsername?: string;
    encryptedPassword?: string;
  };
} {
  const settings = row.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  return {
    presetKey: typeof settings.presetKey === "string" ? settings.presetKey : undefined,
    description:
      typeof settings.description === "string" ? settings.description : undefined,
    requiresApiKey:
      typeof settings.requiresApiKey === "boolean"
        ? settings.requiresApiKey
        : undefined,
    credentials: parseCredentials(settings.credentials),
  };
}

function mergeSettings(
  current: Record<string, unknown>,
  input: Partial<IndexerInput>,
): Record<string, unknown> {
  const next = { ...current };
  const credentials = parseCredentials(next.credentials);

  if (input.username !== undefined) {
    if (input.username) {
      credentials.encryptedUsername = encryptSecret(input.username);
    } else {
      delete credentials.encryptedUsername;
    }
  }

  if (input.password !== undefined) {
    if (input.password) {
      credentials.encryptedPassword = encryptSecret(input.password);
    } else {
      delete credentials.encryptedPassword;
    }
  }

  if (Object.keys(credentials).length) {
    next.credentials = credentials;
  } else {
    delete next.credentials;
  }

  return next;
}

function parseCredentials(value: unknown): {
  encryptedUsername?: string;
  encryptedPassword?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const credentials = value as Record<string, unknown>;

  return {
    encryptedUsername:
      typeof credentials.encryptedUsername === "string"
        ? credentials.encryptedUsername
        : undefined,
    encryptedPassword:
      typeof credentials.encryptedPassword === "string"
        ? credentials.encryptedPassword
        : undefined,
  };
}
