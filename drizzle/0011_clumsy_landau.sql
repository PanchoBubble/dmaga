CREATE TABLE "read_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_key" text NOT NULL,
	"media_kind" text DEFAULT 'manga' NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"cover_url" text,
	"last_provider" text,
	"last_chapter_id" text,
	"last_chapter_number" text,
	"last_page" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "read_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_key" text NOT NULL,
	"unit_kind" text DEFAULT 'chapter' NOT NULL,
	"unit_key" text NOT NULL,
	"provider" text NOT NULL,
	"chapter_id" text NOT NULL,
	"number" text,
	"completed" boolean DEFAULT false NOT NULL,
	"last_page" integer DEFAULT 0 NOT NULL,
	"page_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "read_progress_series_key_idx" ON "read_progress" USING btree ("series_key");--> statement-breakpoint
CREATE INDEX "read_progress_updated_at_idx" ON "read_progress" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "read_units_series_unit_idx" ON "read_units" USING btree ("series_key","unit_key");--> statement-breakpoint
CREATE INDEX "read_units_series_idx" ON "read_units" USING btree ("series_key");