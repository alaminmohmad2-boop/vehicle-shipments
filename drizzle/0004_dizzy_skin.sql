CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`yard_id` text,
	`vin` text NOT NULL,
	`stage` text DEFAULT 'gate_in' NOT NULL,
	`condition` text DEFAULT 'good' NOT NULL,
	`odometer_km` integer,
	`fuel_percent` integer,
	`damage_notes` text DEFAULT '' NOT NULL,
	`inspector_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`yard_id`) REFERENCES `yards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inspections_org_vin` ON `inspections` (`org_id`,`vin`);--> statement-breakpoint
CREATE TABLE `release_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`yard_id` text,
	`vin` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_id` text DEFAULT '' NOT NULL,
	`recipient_phone` text DEFAULT '' NOT NULL,
	`pickup_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_notes` text DEFAULT '' NOT NULL,
	`requested_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`yard_id`) REFERENCES `yards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `release_requests_org` ON `release_requests` (`org_id`,`status`);--> statement-breakpoint
CREATE TABLE `yard_events` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`yard_id` text NOT NULL,
	`vin` text NOT NULL,
	`kind` text NOT NULL,
	`zone` text DEFAULT '' NOT NULL,
	`slot` text DEFAULT '' NOT NULL,
	`gate` text DEFAULT '' NOT NULL,
	`driver_name` text DEFAULT '' NOT NULL,
	`carrier` text DEFAULT '' NOT NULL,
	`truck_plate` text DEFAULT '' NOT NULL,
	`seal_number` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`yard_id`) REFERENCES `yards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `yard_events_org_vin` ON `yard_events` (`org_id`,`vin`);--> statement-breakpoint
CREATE INDEX `yard_events_yard` ON `yard_events` (`yard_id`);--> statement-breakpoint
CREATE TABLE `yards` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`capacity` integer DEFAULT 100 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yards_org_code` ON `yards` (`org_id`,`code`);