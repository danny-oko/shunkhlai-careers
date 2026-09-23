CREATE TABLE `applicant_account` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`clerk_user_id` text,
	`data_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applicant_account_email_key` ON `applicant_account` (`email`);--> statement-breakpoint
CREATE TABLE `applicant_file` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text,
	`chunk_index` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applicant_file_email_kind_chunk_key` ON `applicant_file` (`email`,`kind`,`chunk_index`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `applicant_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`data_json` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `applicant_profile_clerk_user_id_key` ON `applicant_profile` (`clerk_user_id`);