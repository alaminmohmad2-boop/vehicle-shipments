CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_booking` ON `attachments` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`consignee` text DEFAULT '' NOT NULL,
	`carrier` text DEFAULT '' NOT NULL,
	`vessel` text DEFAULT '' NOT NULL,
	`voyage` text DEFAULT '' NOT NULL,
	`cargo_notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`tracking_token` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_org_number` ON `bookings` (`org_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_tracking_token` ON `bookings` (`tracking_token`);--> statement-breakpoint
CREATE INDEX `bookings_org_owner` ON `bookings` (`org_id`,`owner_id`);--> statement-breakpoint
CREATE TABLE `charges` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`tariff_id` text,
	`invoice_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `charges_booking` ON `charges` (`booking_id`);--> statement-breakpoint
CREATE TABLE `counters` (
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`org_id`, `name`)
);
--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_minor` integer NOT NULL,
	`currency` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_lines_invoice` ON `invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`number` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`credits_invoice_id` text,
	`issue_date` text NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_org_number` ON `invoices` (`org_id`,`number`);--> statement-breakpoint
CREATE INDEX `invoices_booking` ON `invoices` (`booking_id`);--> statement-breakpoint
CREATE TABLE `legs` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`position` integer NOT NULL,
	`from_port` text NOT NULL,
	`to_port` text NOT NULL,
	`vessel_voyage` text DEFAULT '' NOT NULL,
	`etd` text,
	`eta` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `legs_booking` ON `legs` (`booking_id`,`position`);--> statement-breakpoint
CREATE TABLE `status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_events_booking` ON `status_events` (`booking_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `tariffs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`basis` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`carrier` text DEFAULT '' NOT NULL,
	`origin_port` text DEFAULT '' NOT NULL,
	`destination_port` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tariffs_org` ON `tariffs` (`org_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`vin` text NOT NULL,
	`make` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`year` integer,
	`length_cm` integer,
	`width_cm` integer,
	`height_cm` integer,
	`weight_kg` integer,
	`status` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_booking_vin` ON `vehicles` (`booking_id`,`vin`);