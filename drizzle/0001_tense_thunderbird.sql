CREATE TABLE "stored_file" (
	"id" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_key" text NOT NULL,
	"filename" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stored_file_owner_key" ON "stored_file" USING btree ("owner_kind","owner_key");--> statement-breakpoint
CREATE INDEX "stored_file_sha256_idx" ON "stored_file" USING btree ("sha256");