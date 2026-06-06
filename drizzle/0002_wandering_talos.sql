ALTER TABLE "debrid_links" ALTER COLUMN "file_size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "host_downloads" ALTER COLUMN "bytes_downloaded" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "media_items" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;