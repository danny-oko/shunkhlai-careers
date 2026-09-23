CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_account" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"clerk_user_id" text,
	"data_json" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_file" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"filename" text,
	"chunk_index" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_link" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"firstname" text,
	"lastname" text,
	"email" text,
	"regno_enc" text NOT NULL,
	"phone_enc" text NOT NULL,
	"erp_access_token_enc" text,
	"erp_refresh_token_enc" text,
	"erp_app_id" text,
	"erp_token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"data_json" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_log" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"job_id" integer NOT NULL,
	"status" text NOT NULL,
	"erp_application_id" integer,
	"error_message" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_article" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"lede" text NOT NULL,
	"category" text NOT NULL,
	"author" text NOT NULL,
	"published_at" text NOT NULL,
	"cover_key" text,
	"cover_alt" text DEFAULT '' NOT NULL,
	"body_json" jsonb NOT NULL,
	"status" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_media" (
	"key" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content_type" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "news_media_key_chunk_index_pk" PRIMARY KEY("key","chunk_index")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_account_email_key" ON "applicant_account" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_file_email_kind_chunk_key" ON "applicant_file" USING btree ("email","kind","chunk_index");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_link_clerk_user_id_key" ON "applicant_link" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_profile_clerk_user_id_key" ON "applicant_profile" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_log_user_job_key" ON "application_log" USING btree ("clerk_user_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_article_slug_key" ON "news_article" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_article_status_published_idx" ON "news_article" USING btree ("status","published_at");