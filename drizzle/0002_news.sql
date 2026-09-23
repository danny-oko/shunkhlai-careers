CREATE TABLE IF NOT EXISTS `news_article` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`lede` text NOT NULL,
	`category` text NOT NULL,
	`author` text NOT NULL,
	`published_at` text NOT NULL,
	`cover_key` text,
	`cover_alt` text DEFAULT '' NOT NULL,
	`body_json` text NOT NULL,
	`status` text NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `news_article_slug_key` ON `news_article` (`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `news_article_status_published_idx` ON `news_article` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `news_media` (
	`key` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content_type` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`key`, `chunk_index`)
);
