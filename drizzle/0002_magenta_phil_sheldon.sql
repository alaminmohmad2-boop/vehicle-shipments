CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`provider` text NOT NULL,
	`state` text NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_booking` ON `notifications` (`booking_id`);