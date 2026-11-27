ALTER TABLE `company_settings` ADD `default_tax_bps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `tax_bps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `fee_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `fee_currency` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `exchange_rate` text DEFAULT '' NOT NULL;