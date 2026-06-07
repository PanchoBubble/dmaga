CREATE TABLE "my_anime_list_discover_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preference_key" text NOT NULL,
	"row_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "my_anime_list_discover_preferences_key_idx" ON "my_anime_list_discover_preferences" USING btree ("preference_key");