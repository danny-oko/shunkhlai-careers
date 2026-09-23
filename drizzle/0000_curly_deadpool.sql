CREATE TABLE `applicant_link` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`firstname` text,
	`lastname` text,
	`email` text,
	`regno_enc` text NOT NULL,
	`phone_enc` text NOT NULL,
	`erp_access_token_enc` text,
	`erp_refresh_token_enc` text,
	`erp_app_id` text,
	`erp_token_expires_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applicant_link_clerk_user_id_key` ON `applicant_link` (`clerk_user_id`);--> statement-breakpoint
CREATE TABLE `application_log` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`job_id` integer NOT NULL,
	`status` text NOT NULL,
	`erp_application_id` integer,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_log_user_job_key` ON `application_log` (`clerk_user_id`,`job_id`);
