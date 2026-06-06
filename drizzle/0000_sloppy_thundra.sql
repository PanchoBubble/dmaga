CREATE TYPE "public"."debrid_item_status" AS ENUM('saved', 'adding', 'waiting_files_selection', 'queued', 'downloading', 'ready', 'error', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."fetch_mode" AS ENUM('direct', 'flaresolverr');--> statement-breakpoint
CREATE TYPE "public"."host_download_status" AS ENUM('queued', 'running', 'complete', 'error', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."indexer_type" AS ENUM('torznab');--> statement-breakpoint
CREATE TYPE "public"."polling_job_status" AS ENUM('active', 'paused', 'complete', 'cancelled', 'error');--> statement-breakpoint
CREATE TABLE "app_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debrid_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"real_debrid_account_id" uuid,
	"real_debrid_torrent_id" text,
	"real_debrid_download_id" text,
	"status" "debrid_item_status" DEFAULT 'saved' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"selected_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_message" text,
	"added_to_debrid_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debrid_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debrid_item_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer,
	"host" text,
	"original_link" text NOT NULL,
	"unrestricted_link" text,
	"mime_type" text,
	"streamable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debrid_link_id" uuid NOT NULL,
	"status" "host_download_status" DEFAULT 'queued' NOT NULL,
	"target_path" text NOT NULL,
	"bytes_downloaded" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "indexer_type" DEFAULT 'torznab' NOT NULL,
	"base_url" text NOT NULL,
	"encrypted_api_key" text,
	"fetch_mode" "fetch_mode" DEFAULT 'direct' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"size_bytes" integer,
	"seeders" integer,
	"leechers" integer,
	"published_at" timestamp with time zone,
	"indexer_id" uuid,
	"indexer_name" text NOT NULL,
	"magnet_url" text,
	"info_hash" text,
	"source_url" text,
	"preview_image_url" text,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polling_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debrid_item_id" uuid NOT NULL,
	"status" "polling_job_status" DEFAULT 'active' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_poll_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"lock_token" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "real_debrid_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text,
	"username" text,
	"email" text,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"last_authenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debrid_items" ADD CONSTRAINT "debrid_items_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debrid_items" ADD CONSTRAINT "debrid_items_real_debrid_account_id_real_debrid_accounts_id_fk" FOREIGN KEY ("real_debrid_account_id") REFERENCES "public"."real_debrid_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debrid_links" ADD CONSTRAINT "debrid_links_debrid_item_id_debrid_items_id_fk" FOREIGN KEY ("debrid_item_id") REFERENCES "public"."debrid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_downloads" ADD CONSTRAINT "host_downloads_debrid_link_id_debrid_links_id_fk" FOREIGN KEY ("debrid_link_id") REFERENCES "public"."debrid_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_indexer_id_indexers_id_fk" FOREIGN KEY ("indexer_id") REFERENCES "public"."indexers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polling_jobs" ADD CONSTRAINT "polling_jobs_debrid_item_id_debrid_items_id_fk" FOREIGN KEY ("debrid_item_id") REFERENCES "public"."debrid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_sessions_token_hash_idx" ON "app_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE INDEX "debrid_items_status_idx" ON "debrid_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "debrid_items_torrent_id_idx" ON "debrid_items" USING btree ("real_debrid_torrent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debrid_items_media_item_idx" ON "debrid_items" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "debrid_links_item_idx" ON "debrid_links" USING btree ("debrid_item_id");--> statement-breakpoint
CREATE INDEX "host_downloads_status_idx" ON "host_downloads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "indexers_enabled_idx" ON "indexers" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "indexers_name_idx" ON "indexers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "media_items_saved_idx" ON "media_items" USING btree ("saved");--> statement-breakpoint
CREATE INDEX "media_items_info_hash_idx" ON "media_items" USING btree ("info_hash");--> statement-breakpoint
CREATE INDEX "media_items_normalized_title_idx" ON "media_items" USING btree ("normalized_title");--> statement-breakpoint
CREATE INDEX "polling_jobs_ready_idx" ON "polling_jobs" USING btree ("status","next_poll_at");--> statement-breakpoint
CREATE UNIQUE INDEX "polling_jobs_debrid_item_idx" ON "polling_jobs" USING btree ("debrid_item_id");