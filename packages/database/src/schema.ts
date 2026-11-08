import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const schemaVersions = sqliteTable('schema_versions', {
  version: integer('version').primaryKey(),
  label: text('label').notNull(),
});

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    broker: text('broker').notNull(),
    market: text('market').notNull(),
    currency: text('currency').notNull(),
    ledgerRevision: integer('ledger_revision').notNull().default(0),
  },
  (table) => [
    uniqueIndex('accounts_identity').on(table.id, table.broker, table.market, table.currency),
    check('accounts_broker', sql`${table.broker} = 'DIME'`),
    check(
      'accounts_market_currency',
      sql`(${table.market} = 'US' AND ${table.currency} = 'USD') OR (${table.market} = 'TH' AND ${table.currency} = 'THB')`,
    ),
    check(
      'accounts_revision',
      sql`typeof(${table.ledgerRevision}) = 'integer' AND ${table.ledgerRevision} >= 0`,
    ),
  ],
);

export const securities = sqliteTable(
  'securities',
  {
    id: text('id').primaryKey(),
    symbol: text('symbol').notNull(),
    market: text('market').notNull(),
    currency: text('currency').notNull(),
    exchangeMic: text('exchange_mic').notNull(),
  },
  (table) => [
    uniqueIndex('securities_identity').on(table.id, table.market, table.currency),
    uniqueIndex('securities_listing').on(table.market, table.symbol, table.exchangeMic),
    check(
      'securities_market_currency',
      sql`(${table.market} = 'US' AND ${table.currency} = 'USD') OR (${table.market} = 'TH' AND ${table.currency} = 'THB')`,
    ),
  ],
);

export const importBatches = sqliteTable(
  'import_batches',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    documentSha256: text('document_sha256').notNull(),
    parserVersion: text('parser_version').notNull(),
    confirmedAt: text('confirmed_at').notNull(),
  },
  (table) => [
    uniqueIndex('import_batches_account_hash').on(table.accountId, table.documentSha256),
    uniqueIndex('import_batches_identity').on(table.id, table.accountId),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    securityId: text('security_id').notNull(),
    broker: text('broker').notNull(),
    market: text('market').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    side: text('side').notNull(),
    executedAt: text('executed_at').notNull(),
    sequence: integer('sequence').notNull(),
    tradeDate: text('trade_date').notNull(),
    quantity: text('quantity').notNull(),
    executionPrice: text('execution_price').notNull(),
    fee: text('fee').notNull(),
    tax: text('tax').notNull(),
    feeCurrency: text('fee_currency').notNull(),
    externalRef: text('external_ref'),
    importBatchId: text('import_batch_id').notNull(),
    sourceRow: integer('source_row').notNull(),
    fingerprint: text('fingerprint').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId, table.broker, table.market, table.currency],
      foreignColumns: [accounts.id, accounts.broker, accounts.market, accounts.currency],
    }),
    foreignKey({
      columns: [table.securityId, table.market, table.currency],
      foreignColumns: [securities.id, securities.market, securities.currency],
    }),
    foreignKey({
      columns: [table.importBatchId, table.accountId],
      foreignColumns: [importBatches.id, importBatches.accountId],
    }),
    uniqueIndex('transactions_account_reference').on(table.accountId, table.externalRef),
    uniqueIndex('transactions_account_fingerprint').on(table.accountId, table.fingerprint),
    uniqueIndex('transactions_canonical_identity').on(table.id, table.accountId, table.fingerprint),
    uniqueIndex('transactions_batch_row').on(table.importBatchId, table.sourceRow),
    index('transactions_ledger_order').on(
      table.accountId,
      table.executedAt,
      table.sequence,
      table.id,
    ),
    index('transactions_security').on(table.securityId),
    check(
      'transactions_supported_policy',
      sql`${table.broker} = 'DIME' AND ${table.market} = 'US' AND ${table.currency} = 'USD' AND ${table.feeCurrency} = 'USD' AND ${table.status} = 'FILLED'`,
    ),
    check('transactions_side', sql`${table.side} IN ('BUY', 'SELL')`),
    check(
      'transactions_sequence',
      sql`typeof(${table.sequence}) = 'integer' AND ${table.sequence} >= 0`,
    ),
    check(
      'transactions_source_row',
      sql`typeof(${table.sourceRow}) = 'integer' AND ${table.sourceRow} >= 1`,
    ),
  ],
);

export const tradeSources = sqliteTable(
  'trade_sources',
  {
    sourceTradeId: text('source_trade_id').notNull(),
    accountId: text('account_id').notNull(),
    externalRef: text('external_ref'),
    importBatchId: text('import_batch_id').notNull(),
    sourceRow: integer('source_row').notNull(),
    fingerprint: text('fingerprint').notNull(),
    transactionId: text('transaction_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importBatchId, table.sourceRow] }),
    foreignKey({
      columns: [table.importBatchId, table.accountId],
      foreignColumns: [importBatches.id, importBatches.accountId],
    }),
    foreignKey({
      columns: [table.transactionId, table.accountId, table.fingerprint],
      foreignColumns: [transactions.id, transactions.accountId, transactions.fingerprint],
    }),
    index('trade_sources_trade_id').on(table.sourceTradeId),
    index('trade_sources_account_reference').on(table.accountId, table.externalRef),
    check(
      'trade_sources_row',
      sql`typeof(${table.sourceRow}) = 'integer' AND ${table.sourceRow} >= 1`,
    ),
  ],
);

// Documentary orders are ledger entries with a different evidence precision.
// Keeping their physical representation additive preserves every legacy fill row
// and fingerprint while the repository exposes one logical ledger.
export const documentOrders = sqliteTable(
  'document_orders',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    securityId: text('security_id').notNull(),
    broker: text('broker').notNull(),
    market: text('market').notNull(),
    currency: text('currency').notNull(),
    precision: text('precision').notNull(),
    status: text('status').notNull(),
    side: text('side').notNull(),
    tradeDate: text('trade_date').notNull(),
    quantity: text('quantity').notNull(),
    unitPrice: text('unit_price').notNull(),
    grossAmount: text('gross_amount').notNull(),
    netAmount: text('net_amount').notNull(),
    fee: text('fee').notNull(),
    tax: text('tax').notNull(),
    feeCurrency: text('fee_currency').notNull(),
    externalRef: text('external_ref').notNull(),
    importBatchId: text('import_batch_id').notNull(),
    sourceRow: integer('source_row').notNull(),
    fingerprint: text('fingerprint').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId, table.broker, table.market, table.currency],
      foreignColumns: [accounts.id, accounts.broker, accounts.market, accounts.currency],
    }),
    foreignKey({
      columns: [table.securityId, table.market, table.currency],
      foreignColumns: [securities.id, securities.market, securities.currency],
    }),
    foreignKey({
      columns: [table.importBatchId, table.accountId],
      foreignColumns: [importBatches.id, importBatches.accountId],
    }),
    uniqueIndex('document_orders_account_reference').on(table.accountId, table.externalRef),
    uniqueIndex('document_orders_account_fingerprint').on(table.accountId, table.fingerprint),
    uniqueIndex('document_orders_canonical_identity').on(
      table.id,
      table.accountId,
      table.fingerprint,
    ),
    uniqueIndex('document_orders_batch_row').on(table.importBatchId, table.sourceRow),
    index('document_orders_ledger_order').on(table.accountId, table.tradeDate, table.id),
    index('document_orders_security').on(table.securityId),
    check(
      'document_orders_supported_policy',
      sql`${table.broker} = 'DIME' AND ${table.market} = 'US' AND ${table.currency} = 'USD' AND ${table.feeCurrency} = 'USD' AND ${table.status} = 'CONFIRMED' AND ${table.precision} = 'DOCUMENT_DATE'`,
    ),
    check('document_orders_side', sql`${table.side} IN ('BUY', 'SELL')`),
    check(
      'document_orders_source_row',
      sql`typeof(${table.sourceRow}) = 'integer' AND ${table.sourceRow} >= 1`,
    ),
  ],
);

export const documentOrderSources = sqliteTable(
  'document_order_sources',
  {
    sourceTradeId: text('source_trade_id').notNull(),
    accountId: text('account_id').notNull(),
    externalRef: text('external_ref').notNull(),
    importBatchId: text('import_batch_id').notNull(),
    sourceRow: integer('source_row').notNull(),
    fingerprint: text('fingerprint').notNull(),
    transactionId: text('transaction_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importBatchId, table.sourceRow] }),
    foreignKey({
      columns: [table.importBatchId, table.accountId],
      foreignColumns: [importBatches.id, importBatches.accountId],
    }),
    foreignKey({
      columns: [table.transactionId, table.accountId, table.fingerprint],
      foreignColumns: [documentOrders.id, documentOrders.accountId, documentOrders.fingerprint],
    }),
    index('document_order_sources_trade_id').on(table.sourceTradeId),
    index('document_order_sources_account_reference').on(table.accountId, table.externalRef),
    check(
      'document_order_sources_row',
      sql`typeof(${table.sourceRow}) = 'integer' AND ${table.sourceRow} >= 1`,
    ),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    importBatchId: text('import_batch_id').notNull(),
    eventType: text('event_type').notNull(),
    recordedAt: text('recorded_at').notNull(),
    insertedCount: integer('inserted_count').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.importBatchId, table.accountId],
      foreignColumns: [importBatches.id, importBatches.accountId],
    }),
    uniqueIndex('audit_events_import').on(table.importBatchId),
    check('audit_events_type', sql`${table.eventType} = 'CONFIRMED_IMPORT'`),
    check(
      'audit_events_count',
      sql`typeof(${table.insertedCount}) = 'integer' AND ${table.insertedCount} >= 0`,
    ),
  ],
);
