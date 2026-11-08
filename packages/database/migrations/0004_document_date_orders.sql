CREATE TABLE `document_order_sources` (
	`source_trade_id` text NOT NULL,
	`account_id` text NOT NULL,
	`external_ref` text NOT NULL,
	`import_batch_id` text NOT NULL,
	`source_row` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`transaction_id` text NOT NULL,
	PRIMARY KEY(`import_batch_id`, `source_row`),
	FOREIGN KEY (`import_batch_id`,`account_id`) REFERENCES `import_batches`(`id`,`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`,`account_id`,`fingerprint`) REFERENCES `document_orders`(`id`,`account_id`,`fingerprint`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "document_order_sources_row" CHECK(typeof("document_order_sources"."source_row") = 'integer' AND "document_order_sources"."source_row" >= 1)
);
--> statement-breakpoint
CREATE INDEX `document_order_sources_trade_id` ON `document_order_sources` (`source_trade_id`);--> statement-breakpoint
CREATE INDEX `document_order_sources_account_reference` ON `document_order_sources` (`account_id`,`external_ref`);--> statement-breakpoint
CREATE TABLE `document_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`security_id` text NOT NULL,
	`broker` text NOT NULL,
	`market` text NOT NULL,
	`currency` text NOT NULL,
	`precision` text NOT NULL,
	`status` text NOT NULL,
	`side` text NOT NULL,
	`trade_date` text NOT NULL,
	`quantity` text NOT NULL,
	`unit_price` text NOT NULL,
	`gross_amount` text NOT NULL,
	`net_amount` text NOT NULL,
	`fee` text NOT NULL,
	`tax` text NOT NULL,
	`fee_currency` text NOT NULL,
	`external_ref` text NOT NULL,
	`import_batch_id` text NOT NULL,
	`source_row` integer NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`account_id`,`broker`,`market`,`currency`) REFERENCES `accounts`(`id`,`broker`,`market`,`currency`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`security_id`,`market`,`currency`) REFERENCES `securities`(`id`,`market`,`currency`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_batch_id`,`account_id`) REFERENCES `import_batches`(`id`,`account_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "document_orders_supported_policy" CHECK("document_orders"."broker" = 'DIME' AND "document_orders"."market" = 'US' AND "document_orders"."currency" = 'USD' AND "document_orders"."fee_currency" = 'USD' AND "document_orders"."status" = 'CONFIRMED' AND "document_orders"."precision" = 'DOCUMENT_DATE'),
	CONSTRAINT "document_orders_side" CHECK("document_orders"."side" IN ('BUY', 'SELL')),
	CONSTRAINT "document_orders_source_row" CHECK(typeof("document_orders"."source_row") = 'integer' AND "document_orders"."source_row" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_orders_account_reference` ON `document_orders` (`account_id`,`external_ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_orders_account_fingerprint` ON `document_orders` (`account_id`,`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_orders_canonical_identity` ON `document_orders` (`id`,`account_id`,`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_orders_batch_row` ON `document_orders` (`import_batch_id`,`source_row`);--> statement-breakpoint
CREATE INDEX `document_orders_ledger_order` ON `document_orders` (`account_id`,`trade_date`,`id`);--> statement-breakpoint
CREATE INDEX `document_orders_security` ON `document_orders` (`security_id`);
--> statement-breakpoint
-- The legacy fill tables remain intact. Both evidence precisions participate in
-- the same identity checks, account revision, import batch and audit transaction.
CREATE VIEW ledger_trade_identities AS
SELECT id AS source_trade_id, account_id, external_ref, fingerprint FROM transactions
UNION ALL
SELECT id AS source_trade_id, account_id, external_ref, fingerprint FROM document_orders
UNION ALL
SELECT source_trade_id, account_id, external_ref, fingerprint FROM trade_sources
UNION ALL
SELECT source_trade_id, account_id, external_ref, fingerprint FROM document_order_sources;
--> statement-breakpoint
CREATE TRIGGER document_orders_no_update BEFORE UPDATE ON document_orders
BEGIN SELECT RAISE(ABORT, 'Document orders are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER document_orders_no_delete BEFORE DELETE ON document_orders
BEGIN SELECT RAISE(ABORT, 'Document orders are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER document_order_sources_no_update BEFORE UPDATE ON document_order_sources
BEGIN SELECT RAISE(ABORT, 'Document order sources are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER document_order_sources_no_delete BEFORE DELETE ON document_order_sources
BEGIN SELECT RAISE(ABORT, 'Document order sources are append-only'); END;
--> statement-breakpoint
DROP TRIGGER trade_sources_identity;
--> statement-breakpoint
CREATE TRIGGER trade_sources_identity BEFORE INSERT ON trade_sources
WHEN EXISTS (
  SELECT 1 FROM ledger_trade_identities AS existing
  WHERE (existing.source_trade_id = NEW.source_trade_id AND existing.fingerprint <> NEW.fingerprint)
     OR (existing.account_id = NEW.account_id AND existing.external_ref IS NOT NULL AND NEW.external_ref IS NOT NULL
       AND ((existing.external_ref = NEW.external_ref AND existing.fingerprint <> NEW.fingerprint)
         OR (existing.fingerprint = NEW.fingerprint AND existing.external_ref <> NEW.external_ref)))
) OR EXISTS (
  SELECT 1 FROM document_order_sources WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
) OR EXISTS (
  SELECT 1 FROM document_orders WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
)
BEGIN SELECT RAISE(ABORT, 'Trade source identity conflict'); END;
--> statement-breakpoint
CREATE TRIGGER document_order_sources_identity BEFORE INSERT ON document_order_sources
WHEN EXISTS (
  SELECT 1 FROM ledger_trade_identities AS existing
  WHERE (existing.source_trade_id = NEW.source_trade_id AND existing.fingerprint <> NEW.fingerprint)
     OR (existing.account_id = NEW.account_id AND existing.external_ref IS NOT NULL
       AND ((existing.external_ref = NEW.external_ref AND existing.fingerprint <> NEW.fingerprint)
         OR (existing.fingerprint = NEW.fingerprint AND existing.external_ref <> NEW.external_ref)))
) OR EXISTS (
  SELECT 1 FROM trade_sources WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
) OR EXISTS (
  SELECT 1 FROM transactions WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
)
BEGIN SELECT RAISE(ABORT, 'Trade source identity conflict'); END;
--> statement-breakpoint
CREATE TRIGGER document_orders_identity BEFORE INSERT ON document_orders
WHEN EXISTS (
  SELECT 1 FROM ledger_trade_identities AS existing
  WHERE (existing.source_trade_id = NEW.id AND existing.fingerprint <> NEW.fingerprint)
     OR (existing.account_id = NEW.account_id AND existing.external_ref IS NOT NULL
       AND ((existing.external_ref = NEW.external_ref AND existing.fingerprint <> NEW.fingerprint)
         OR (existing.fingerprint = NEW.fingerprint AND existing.external_ref <> NEW.external_ref)))
) OR EXISTS (
  SELECT 1 FROM transactions WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
) OR EXISTS (
  SELECT 1 FROM trade_sources WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
)
BEGIN SELECT RAISE(ABORT, 'Trade identity conflict'); END;
--> statement-breakpoint
-- Until an audited order-to-fill reconciliation exists, importing both
-- representations for one account/security could count the same shares twice.
-- Dates and references cannot prove disjoint history, so guard every day and
-- both insertion directions, including rows earlier in this atomic batch.
CREATE TRIGGER document_orders_precision_guard BEFORE INSERT ON document_orders
WHEN EXISTS (
  SELECT 1 FROM transactions
  WHERE account_id = NEW.account_id AND security_id = NEW.security_id
)
BEGIN SELECT RAISE(ABORT, 'Unlinked execution and documentary precision cannot coexist'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_document_precision_guard BEFORE INSERT ON transactions
WHEN EXISTS (
  SELECT 1 FROM document_orders
  WHERE account_id = NEW.account_id AND security_id = NEW.security_id
)
BEGIN SELECT RAISE(ABORT, 'Unlinked execution and documentary precision cannot coexist'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_document_identity BEFORE INSERT ON transactions
WHEN EXISTS (
  SELECT 1 FROM ledger_trade_identities AS existing
  WHERE (existing.source_trade_id = NEW.id AND existing.fingerprint <> NEW.fingerprint)
     OR (existing.account_id = NEW.account_id AND existing.external_ref IS NOT NULL AND NEW.external_ref IS NOT NULL
       AND ((existing.external_ref = NEW.external_ref AND existing.fingerprint <> NEW.fingerprint)
         OR (existing.fingerprint = NEW.fingerprint AND existing.external_ref <> NEW.external_ref)))
) OR EXISTS (
  SELECT 1 FROM document_orders WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
) OR EXISTS (
  SELECT 1 FROM document_order_sources WHERE import_batch_id = NEW.import_batch_id AND source_row = NEW.source_row
)
BEGIN SELECT RAISE(ABORT, 'Trade identity conflict'); END;
