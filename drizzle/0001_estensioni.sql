ALTER TABLE `users` ADD COLUMN `seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`at` integer NOT NULL,
	`editor` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_revisions_record` ON `revisions` (`record_id`);
