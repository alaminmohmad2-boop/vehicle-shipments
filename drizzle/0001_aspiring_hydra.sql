CREATE TABLE `company_settings` (
	`org_id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`logo` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
