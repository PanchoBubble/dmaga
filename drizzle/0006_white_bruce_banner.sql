CREATE TABLE "my_anime_list_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text,
	"username" text,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"last_authenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
