CREATE TABLE `market_budget` (
	`provider` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`day_count` integer NOT NULL,
	`month` text NOT NULL,
	`month_count` integer NOT NULL,
	`next_at` integer NOT NULL,
	`refresh_at` integer NOT NULL,
	`lease` text NOT NULL,
	`lease_until` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_cache` (
	`namespace` text NOT NULL,
	`symbol` text NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`namespace`, `symbol`)
);
--> statement-breakpoint
CREATE INDEX `market_cache_fetched_at` ON `market_cache` (`fetched_at`);--> statement-breakpoint
CREATE TABLE `market_credentials` (
	`slot` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`key_version` integer NOT NULL,
	`nonce` text NOT NULL,
	`ciphertext` text NOT NULL,
	`tested_at` text,
	CONSTRAINT "market_credential_slot" CHECK("market_credentials"."slot" IN ('candidate', 'active')),
	CONSTRAINT "market_credential_key_version" CHECK("market_credentials"."key_version" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_credentials_version_unique` ON `market_credentials` (`version`);