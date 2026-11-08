import { ImportBatchSchema, TradeSchema } from '@portfolio/contracts';
import {
  LedgerConflictError,
  LedgerRevisionConflictError,
  mergeLedger,
  tradeFingerprint,
  validateTrade,
  type TradeAlias,
  type TransactionRepository,
} from '@portfolio/domain';

const batchColumns = `id, account_id AS accountId, document_sha256 AS documentSha256,
  parser_version AS parserVersion, confirmed_at AS confirmedAt`;
const tradeColumns = `id, account_id AS accountId, security_id AS securityId, broker,
  market, currency, status, side, executed_at AS executedAt, sequence, trade_date AS tradeDate,
  quantity, execution_price AS executionPrice, fee, tax, fee_currency AS feeCurrency,
  external_ref AS externalRef, import_batch_id AS importBatchId, source_row AS sourceRow, fingerprint`;
const orderColumns = `id, account_id AS accountId, security_id AS securityId, broker,
  market, currency, precision, status, side, NULL AS executedAt, NULL AS sequence,
  trade_date AS tradeDate, quantity, NULL AS executionPrice, unit_price AS unitPrice,
  gross_amount AS grossAmount, net_amount AS netAmount, fee, tax, fee_currency AS feeCurrency,
  external_ref AS externalRef, import_batch_id AS importBatchId, source_row AS sourceRow, fingerprint`;

// Only this particular guard constraint signals a stale snapshot. Other constraints
// (including duplicate identities and foreign keys) must remain visible to callers.
function isRevisionGuardFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('NOT NULL constraint failed: accounts.ledger_revision') ||
    (error.cause !== undefined && isRevisionGuardFailure(error.cause))
  );
}

export function createD1TransactionRepository(binding: D1Database): TransactionRepository {
  return {
    async readLedger(accountId) {
      // A session starts at the primary; batch() reads the complete ledger in one
      // transaction, so revision and trades always describe the same snapshot.
      const session = binding.withSession('first-primary');
      const [accountResult, tradesResult, ordersResult, batchesResult, aliasesResult] =
        await session.batch<Record<string, unknown>>([
          session
            .prepare('SELECT ledger_revision AS revision FROM accounts WHERE id = ?')
            .bind(accountId),
          session
            .prepare(
              `SELECT ${tradeColumns} FROM transactions WHERE account_id = ? ORDER BY executed_at, sequence, id`,
            )
            .bind(accountId),
          session
            .prepare(
              `SELECT ${orderColumns} FROM document_orders WHERE account_id = ? ORDER BY trade_date, id`,
            )
            .bind(accountId),
          session
            .prepare(
              `SELECT ${batchColumns} FROM import_batches WHERE account_id = ? ORDER BY confirmed_at, id`,
            )
            .bind(accountId),
          session
            .prepare(
              `SELECT source_trade_id AS id, account_id AS accountId,
          external_ref AS externalRef, import_batch_id AS importBatchId, source_row AS sourceRow,
          fingerprint FROM trade_sources WHERE account_id = ?
          UNION ALL SELECT source_trade_id AS id, account_id AS accountId,
          external_ref AS externalRef, import_batch_id AS importBatchId, source_row AS sourceRow,
          fingerprint FROM document_order_sources WHERE account_id = ? ORDER BY importBatchId, sourceRow`,
            )
            .bind(accountId, accountId),
        ]);
      const revision = accountResult?.results[0]?.revision;
      if (!Number.isSafeInteger(revision) || typeof revision !== 'number' || revision < 0) {
        throw new Error('Account ledger revision is missing or invalid');
      }
      const trades = [...(tradesResult?.results ?? []), ...(ordersResult?.results ?? [])].map(
        (row) => {
          const { fingerprint, ...data } = row;
          const trade = validateTrade(TradeSchema.parse(data));
          if (trade.accountId !== accountId || fingerprint !== tradeFingerprint(trade)) {
            throw new LedgerConflictError('Stored trade identity is invalid');
          }
          return trade;
        },
      );
      const batches = (batchesResult?.results ?? []).map((row) => {
        const batch = ImportBatchSchema.parse(row);
        if (batch.accountId !== accountId)
          throw new LedgerConflictError('Stored batch account mismatch');
        return batch;
      });
      // mergeLedger validates all persisted aliases against canonical identity and
      // their primitive types before the typed snapshot crosses the adapter port.
      const aliases = (aliasesResult?.results ?? []) as unknown as TradeAlias[];
      mergeLedger(trades, [], aliases);
      return { revision, trades, batches, aliases };
    },

    async appendBatch(inputBatch, inputTrades, expectedRevision, inputSources) {
      const batch = ImportBatchSchema.parse(inputBatch);
      const trades = inputTrades.map((trade) => validateTrade(TradeSchema.parse(trade)));
      const sources = inputSources.map((trade) => validateTrade(TradeSchema.parse(trade)));
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new Error('Expected ledger revision must be a non-negative safe integer');
      }
      for (const trade of [...trades, ...sources]) {
        if (trade.accountId !== batch.accountId || trade.importBatchId !== batch.id) {
          throw new LedgerConflictError('Trade provenance does not match its batch');
        }
      }
      const sourceRows = new Map<number, (typeof sources)[number]>();
      for (const source of sources) {
        const previous = sourceRows.get(source.sourceRow);
        if (previous && JSON.stringify(previous) !== JSON.stringify(source)) {
          throw new LedgerConflictError('One document row cannot have different trade identities');
        }
        sourceRows.set(source.sourceRow, source);
      }
      for (const trade of trades) {
        const source = sourceRows.get(trade.sourceRow);
        if (!source || JSON.stringify(source) !== JSON.stringify(trade)) {
          throw new LedgerConflictError('Every new trade requires its reviewed source row');
        }
      }
      const statements = [
        binding
          .prepare(
            `UPDATE accounts SET ledger_revision = CASE
          WHEN ledger_revision = ? THEN ledger_revision + 1 ELSE NULL END WHERE id = ?`,
          )
          .bind(expectedRevision, batch.accountId),
        binding
          .prepare(
            `INSERT INTO import_batches
          (id, account_id, document_sha256, parser_version, confirmed_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            batch.id,
            batch.accountId,
            batch.documentSha256,
            batch.parserVersion,
            batch.confirmedAt,
          ),
        ...trades.map((trade) =>
          trade.status === 'CONFIRMED'
            ? binding
                .prepare(
                  `INSERT INTO document_orders
          (id, account_id, security_id, broker, market, currency, precision, status, side,
           trade_date, quantity, unit_price, gross_amount, net_amount, fee, tax, fee_currency,
           external_ref, import_batch_id, source_row, fingerprint)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                  trade.id,
                  trade.accountId,
                  trade.securityId,
                  trade.broker,
                  trade.market,
                  trade.currency,
                  trade.precision,
                  trade.status,
                  trade.side,
                  trade.tradeDate,
                  trade.quantity,
                  trade.unitPrice,
                  trade.grossAmount,
                  trade.netAmount,
                  trade.fee,
                  trade.tax,
                  trade.feeCurrency,
                  trade.externalRef,
                  trade.importBatchId,
                  trade.sourceRow,
                  tradeFingerprint(trade),
                )
            : binding
                .prepare(
                  `INSERT INTO transactions
          (id, account_id, security_id, broker, market, currency, status, side, executed_at,
           sequence, trade_date, quantity, execution_price, fee, tax, fee_currency,
           external_ref, import_batch_id, source_row, fingerprint)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                  trade.id,
                  trade.accountId,
                  trade.securityId,
                  trade.broker,
                  trade.market,
                  trade.currency,
                  trade.status,
                  trade.side,
                  trade.executedAt,
                  trade.sequence,
                  trade.tradeDate,
                  trade.quantity,
                  trade.executionPrice,
                  trade.fee,
                  trade.tax,
                  trade.feeCurrency,
                  trade.externalRef,
                  trade.importBatchId,
                  trade.sourceRow,
                  tradeFingerprint(trade),
                ),
        ),
        ...[...sourceRows.values()].map((source) => {
          const sourceTable =
            source.status === 'CONFIRMED' ? 'document_order_sources' : 'trade_sources';
          const canonicalTable = source.status === 'CONFIRMED' ? 'document_orders' : 'transactions';
          return binding
            .prepare(
              `INSERT INTO ${sourceTable}
          (source_trade_id, account_id, external_ref, import_batch_id, source_row, fingerprint, transaction_id)
          VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM ${canonicalTable} WHERE account_id = ? AND fingerprint = ?))`,
            )
            .bind(
              source.id,
              source.accountId,
              source.externalRef,
              source.importBatchId,
              source.sourceRow,
              tradeFingerprint(source),
              source.accountId,
              tradeFingerprint(source),
            );
        }),
        binding
          .prepare(
            `INSERT INTO audit_events
          (id, account_id, import_batch_id, event_type, recorded_at, inserted_count)
          VALUES (?, ?, ?, 'CONFIRMED_IMPORT', ?, ?)`,
          )
          .bind(
            `confirmed-import:${batch.id}`,
            batch.accountId,
            batch.id,
            batch.confirmedAt,
            trades.length,
          ),
      ];
      try {
        // D1 batch rolls every statement back if any guard or constraint fails.
        // SQL precision guards also reject unlinked fill/order representations
        // for the same account/security, including concurrent or direct appends.
        await binding.batch(statements);
      } catch (error) {
        if (isRevisionGuardFailure(error)) throw new LedgerRevisionConflictError();
        throw error;
      }
    },
  };
}
