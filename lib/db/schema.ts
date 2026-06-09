import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const fetchModeEnum = pgEnum("fetch_mode", ["direct", "flaresolverr"]);
export const indexerTypeEnum = pgEnum("indexer_type", [
  "torznab",
  "cardigann",
  "torrentio",
  "internet_archive",
  "minerva",
]);
export const debridItemStatusEnum = pgEnum("debrid_item_status", [
  "saved",
  "adding",
  "waiting_files_selection",
  "queued",
  "downloading",
  "ready",
  "error",
  "deleted",
]);
export const pollingJobStatusEnum = pgEnum("polling_job_status", [
  "active",
  "paused",
  "complete",
  "cancelled",
  "error",
]);
export const hostDownloadStatusEnum = pgEnum("host_download_status", [
  "queued",
  "running",
  "complete",
  "error",
  "cancelled",
]);
// Where a tracked item's content comes from. `real_debrid` is the original
// (and default) path; `torrent` is a local qBittorrent download served from
// disk; `direct` streams straight from an indexer-provided HTTP URL.
export const mediaProviderEnum = pgEnum("media_provider", [
  "real_debrid",
  "torrent",
  "direct",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const appSessions = pgTable(
  "app_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("app_sessions_token_hash_idx").on(table.sessionTokenHash)],
);

export const realDebridAccounts = pgTable("real_debrid_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("account_id"),
  username: text("username"),
  email: text("email"),
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  encryptedOAuthClientId: text("encrypted_oauth_client_id"),
  encryptedOAuthClientSecret: text("encrypted_oauth_client_secret"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),
  ...timestamps,
});

export const myAnimeListAccounts = pgTable("my_anime_list_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("account_id"),
  username: text("username"),
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),
  ...timestamps,
});

export const myAnimeListDiscoverPreferences = pgTable(
  "my_anime_list_discover_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    preferenceKey: text("preference_key").notNull(),
    rowOrder: jsonb("row_order").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("my_anime_list_discover_preferences_key_idx").on(table.preferenceKey),
  ],
);

export const indexers = pgTable(
  "indexers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: indexerTypeEnum("type").notNull().default("torznab"),
    baseUrl: text("base_url").notNull(),
    encryptedApiKey: text("encrypted_api_key"),
    fetchMode: fetchModeEnum("fetch_mode").notNull().default("direct"),
    enabled: boolean("enabled").notNull().default(true),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestStatus: text("last_test_status"),
    ...timestamps,
  },
  (table) => [
    index("indexers_enabled_idx").on(table.enabled),
    uniqueIndex("indexers_name_idx").on(table.name),
  ],
);

export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    seeders: integer("seeders"),
    leechers: integer("leechers"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    indexerId: uuid("indexer_id").references(() => indexers.id, {
      onDelete: "set null",
    }),
    indexerName: text("indexer_name").notNull(),
    magnetUrl: text("magnet_url"),
    infoHash: text("info_hash"),
    sourceUrl: text("source_url"),
    originSection: text("origin_section").notNull().default("other"),
    previewImageUrl: text("preview_image_url"),
    saved: boolean("saved").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("media_items_saved_idx").on(table.saved),
    index("media_items_info_hash_idx").on(table.infoHash),
    index("media_items_normalized_title_idx").on(table.normalizedTitle),
  ],
);

export const viewedTitles = pgTable(
  "viewed_titles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogType: text("catalog_type").notNull(),
    catalogId: text("catalog_id").notNull(),
    title: text("title").notNull(),
    myAnimeListUrl: text("my_anime_list_url"),
    viewed: boolean("viewed").notNull().default(false),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("viewed_titles_catalog_idx").on(table.catalogType, table.catalogId),
    index("viewed_titles_viewed_idx").on(table.viewed),
  ],
);

export const debridItems = pgTable(
  "debrid_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    provider: mediaProviderEnum("provider").notNull().default("real_debrid"),
    realDebridAccountId: uuid("real_debrid_account_id").references(
      () => realDebridAccounts.id,
      { onDelete: "set null" },
    ),
    realDebridTorrentId: text("real_debrid_torrent_id"),
    realDebridDownloadId: text("real_debrid_download_id"),
    status: debridItemStatusEnum("status").notNull().default("saved"),
    progress: integer("progress").notNull().default(0),
    selectedFileIds: jsonb("selected_file_ids").$type<string[]>().notNull().default([]),
    files: jsonb("files").$type<Record<string, unknown>[]>().notNull().default([]),
    errorMessage: text("error_message"),
    addedToDebridAt: timestamp("added_to_debrid_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("debrid_items_status_idx").on(table.status),
    index("debrid_items_torrent_id_idx").on(table.realDebridTorrentId),
    uniqueIndex("debrid_items_media_item_idx").on(table.mediaItemId),
  ],
);

export const pollingJobs = pgTable(
  "polling_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debridItemId: uuid("debrid_item_id")
      .notNull()
      .references(() => debridItems.id, { onDelete: "cascade" }),
    status: pollingJobStatusEnum("status").notNull().default("active"),
    attempts: integer("attempts").notNull().default(0),
    nextPollAt: timestamp("next_poll_at", { withTimezone: true }).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockToken: text("lock_token"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    index("polling_jobs_ready_idx").on(table.status, table.nextPollAt),
    uniqueIndex("polling_jobs_debrid_item_idx").on(table.debridItemId),
  ],
);

export const debridLinks = pgTable(
  "debrid_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debridItemId: uuid("debrid_item_id")
      .notNull()
      .references(() => debridItems.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    host: text("host"),
    originalLink: text("original_link").notNull(),
    unrestrictedLink: text("unrestricted_link"),
    // Absolute path of the file on disk (under the downloads dir) for
    // torrent-provider items. Null for Real-Debrid / direct links, which
    // resolve to a remote URL instead.
    localPath: text("local_path"),
    mimeType: text("mime_type"),
    streamable: boolean("streamable").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("debrid_links_item_idx").on(table.debridItemId)],
);

export const hostDownloads = pgTable(
  "host_downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debridLinkId: uuid("debrid_link_id")
      .notNull()
      .references(() => debridLinks.id, { onDelete: "cascade" }),
    status: hostDownloadStatusEnum("status").notNull().default("queued"),
    targetPath: text("target_path").notNull(),
    bytesDownloaded: bigint("bytes_downloaded", { mode: "number" })
      .notNull()
      .default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("host_downloads_status_idx").on(table.status)],
);
