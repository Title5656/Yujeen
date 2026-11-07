CREATE TABLE `trade_sources` (
	`source_trade_id` text NOT NULL,
	`account_id` text NOT NULL,
	`external_ref` text,
	`import_batch_id` text NOT NULL,
	`source_row` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`transaction_id` text NOT NULL,
	PRIMARY KEY(`import_batch_id`, `source_row`),
	FOREIGN KEY (`import_batch_id`,`account_id`) REFERENCES `import_batches`(`id`,`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`,`account_id`,`fingerprint`) REFERENCES `transactions`(`id`,`account_id`,`fingerprint`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "trade_sources_row" CHECK(typeof("trade_sources"."source_row") = 'integer' AND "trade_sources"."source_row" >= 1)
);
--> statement-breakpoint
CREATE INDEX `trade_sources_trade_id` ON `trade_sources` (`source_trade_id`);--> statement-breakpoint
CREATE INDEX `trade_sources_account_reference` ON `trade_sources` (`account_id`,`external_ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_canonical_identity` ON `transactions` (`id`,`account_id`,`fingerprint`);
--> statement-breakpoint
INSERT INTO trade_sources (source_trade_id, account_id, external_ref, import_batch_id, source_row, fingerprint, transaction_id)
SELECT id, account_id, external_ref, import_batch_id, source_row, fingerprint, id FROM transactions;
--> statement-breakpoint
CREATE TRIGGER trade_sources_no_update BEFORE UPDATE ON trade_sources
BEGIN SELECT RAISE(ABORT, 'Trade sources are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER trade_sources_no_delete BEFORE DELETE ON trade_sources
BEGIN SELECT RAISE(ABORT, 'Trade sources are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER trade_sources_identity BEFORE INSERT ON trade_sources
WHEN EXISTS (
  SELECT 1 FROM (
    SELECT id AS source_trade_id, account_id, external_ref, fingerprint FROM transactions
    UNION ALL
    SELECT source_trade_id, account_id, external_ref, fingerprint FROM trade_sources
  ) AS existing
  WHERE (existing.source_trade_id = NEW.source_trade_id AND existing.fingerprint <> NEW.fingerprint)
     OR (existing.account_id = NEW.account_id AND existing.external_ref IS NOT NULL AND NEW.external_ref IS NOT NULL
       AND ((existing.external_ref = NEW.external_ref AND existing.fingerprint <> NEW.fingerprint)
         OR (existing.fingerprint = NEW.fingerprint AND existing.external_ref <> NEW.external_ref)))
)
BEGIN SELECT RAISE(ABORT, 'Trade source identity conflict'); END;
