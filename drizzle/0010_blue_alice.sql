CREATE TYPE "public"."media_provider" AS ENUM('real_debrid', 'torrent', 'direct');--> statement-breakpoint
ALTER TABLE "debrid_items" ADD COLUMN "provider" "media_provider" DEFAULT 'real_debrid' NOT NULL;--> statement-breakpoint
ALTER TABLE "debrid_links" ADD COLUMN "local_path" text;