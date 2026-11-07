CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`broker` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`ledger_revision` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "accounts_broker" CHECK("accounts"."broker" = 'DIME'),
	CONSTRAINT "accounts_market_currency" CHECK(("accounts"."market" = 'US' AND "accounts"."currency" = 'USD') OR ("accounts"."market" = 'TH' AND "accounts"."currency" = 'THB')),
	CONSTRAINT "accounts_revision" CHECK(typeof("accounts"."ledger_revision") = 'integer' AND "accounts"."ledger_revision" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_identity` ON `accounts` (`id`,`broker`,`market`,`currency`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`import_batch_id` text NOT NULL,
	`event_type` text NOT NULL,
	`recorded_at` text NOT NULL,
	`inserted_count` integer NOT NULL,
	FOREIGN KEY (`import_batch_id`,`account_id`) REFERENCES `import_batches`(`id`,`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_events_type" CHECK("audit_events"."event_type" = 'CONFIRMED_IMPORT'),
	CONSTRAINT "audit_events_count" CHECK(typeof("audit_events"."inserted_count") = 'integer' AND "audit_events"."inserted_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_import` ON `audit_events` (`import_batch_id`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`document_sha256` text NOT NULL,
	`parser_version` text NOT NULL,
	`confirmed_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batches_account_hash` ON `import_batches` (`account_id`,`document_sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `import_batches_identity` ON `import_batches` (`id`,`account_id`);--> statement-breakpoint
CREATE TABLE `securities` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`exchange_mic` text NOT NULL,
	CONSTRAINT "securities_market_currency" CHECK(("securities"."market" = 'US' AND "securities"."currency" = 'USD') OR ("securities"."market" = 'TH' AND "securities"."currency" = 'THB'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `securities_identity` ON `securities` (`id`,`market`,`currency`);--> statement-breakpoint
CREATE UNIQUE INDEX `securities_listing` ON `securities` (`market`,`symbol`,`exchange_mic`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`security_id` text NOT NULL,
	`broker` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`side` text NOT NULL,
	`executed_at` text NOT NULL,
	`sequence` integer NOT NULL,
	`trade_date` text NOT NULL,
	`quantity` text NOT NULL,
	`execution_price` text NOT NULL,
	`fee` text NOT NULL,
	`tax` text NOT NULL,
	`fee_currency` text NOT NULL,
	`external_ref` text,
	`import_batch_id` text NOT NULL,
	`source_row` integer NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`account_id`,`broker`,`market`,`currency`) REFERENCES `accounts`(`id`,`broker`,`market`,`currency`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`security_id`,`market`,`currency`) REFERENCES `securities`(`id`,`market`,`currency`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_batch_id`,`account_id`) REFERENCES `import_batches`(`id`,`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_supported_policy" CHECK("transactions"."broker" = 'DIME' AND "transactions"."market" = 'US' AND "transactions"."currency" = 'USD' AND "transactions"."fee_currency" = 'USD' AND "transactions"."status" = 'FILLED'),
	CONSTRAINT "transactions_side" CHECK("transactions"."side" IN ('BUY', 'SELL')),
	CONSTRAINT "transactions_sequence" CHECK(typeof("transactions"."sequence") = 'integer' AND "transactions"."sequence" >= 0),
	CONSTRAINT "transactions_source_row" CHECK(typeof("transactions"."source_row") = 'integer' AND "transactions"."source_row" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_account_reference` ON `transactions` (`account_id`,`external_ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_account_fingerprint` ON `transactions` (`account_id`,`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_batch_row` ON `transactions` (`import_batch_id`,`source_row`);--> statement-breakpoint
CREATE INDEX `transactions_ledger_order` ON `transactions` (`account_id`,`executed_at`,`sequence`,`id`);
--> statement-breakpoint
-- M1 is append-only. A future correction workflow must use a separate audited migration.
CREATE TRIGGER transactions_no_update BEFORE UPDATE ON transactions
BEGIN SELECT RAISE(ABORT, 'Transactions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_no_delete BEFORE DELETE ON transactions
BEGIN SELECT RAISE(ABORT, 'Transactions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER import_batches_no_update BEFORE UPDATE ON import_batches
BEGIN SELECT RAISE(ABORT, 'Import batches are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER import_batches_no_delete BEFORE DELETE ON import_batches
BEGIN SELECT RAISE(ABORT, 'Import batches are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END;
