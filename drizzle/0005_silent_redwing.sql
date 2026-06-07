CREATE TABLE "viewed_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_type" text NOT NULL,
	"catalog_id" text NOT NULL,
	"title" text NOT NULL,
	"my_anime_list_url" text,
	"viewed" boolean DEFAULT false NOT NULL,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "viewed_titles_catalog_idx" ON "viewed_titles" USING btree ("catalog_type","catalog_id");--> statement-breakpoint
CREATE INDEX "viewed_titles_viewed_idx" ON "viewed_titles" USING btree ("viewed");