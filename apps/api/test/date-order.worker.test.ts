import { env } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import * as persistence from '@portfolio/database';
import * as domain from '@portfolio/domain';
import { recordConfirmedTrades } from '../src/modules/transactions/record-confirmed-trades.js';

const batch = (id = 'order-batch-1', character = 'a') => ({
  id,
  accountId: 'account-1',
  documentSha256: character.repeat(64),
  parserVersion: 'mock-document-order-v1',
  confirmedAt: '2026-11-06T18:00:00.000Z',
});
const order = (overrides: Partial<domain.DocumentOrderTrade> = {}): domain.DocumentOrderTrade => ({
  id: 'order-1',
  accountId: 'account-1',
  securityId: 'security-1',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  precision: 'DOCUMENT_DATE',
  status: 'CONFIRMED',
  side: 'BUY',
  executedAt: null,
  sequence: null,
  tradeDate: '2026-11-05',
  quantity: '3',
  executionPrice: null,
  unitPrice: '3.33',
  grossAmount: '10',
  netAmount: '10.2',
  fee: '0.2',
  tax: '0',
  feeCurrency: 'USD',
  externalRef: 'mock-order:2026-11-05:security-1:ref-1',
  importBatchId: 'order-batch-1',
  sourceRow: 1,
  ...overrides,
});
const fill = (overrides: Partial<domain.ExecutionTrade> = {}): domain.ExecutionTrade => ({
  id: 'fill-1',
  accountId: 'account-1',
  securityId: 'security-1',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  status: 'FILLED',
  side: 'BUY',
  executedAt: '2026-11-04T15:00:00.000Z',
  sequence: 0,
  tradeDate: '2026-11-04',
  quantity: '2',
  executionPrice: '4',
  fee: '0',
  tax: '0',
  feeCurrency: 'USD',
  externalRef: 'mock-fill-1',
  importBatchId: 'order-batch-1',
  sourceRow: 1,
  ...overrides,
});

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const database = persistence.createDatabase(env.DB);
  await database.insert(persistence.accounts).values({
    id: 'account-1',
    broker: 'DIME',
    market: 'US',
    currency: 'USD',
  });
  await database.insert(persistence.securities).values({
    id: 'security-1',
    symbol: 'MOCK',
    market: 'US',
    currency: 'USD',
    exchangeMic: 'XNAS',
  });
});

describe('document date orders in the confirmed D1 ledger', () => {
  it('upgrades an existing fill ledger without rewriting fingerprints, sources or audit', async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, 4));
    const database = persistence.createDatabase(env.DB);
    await database.insert(persistence.accounts).values({
      id: 'account-1',
      broker: 'DIME',
      market: 'US',
      currency: 'USD',
      ledgerRevision: 1,
    });
    await database.insert(persistence.securities).values({
      id: 'security-1',
      symbol: 'MOCK',
      market: 'US',
      currency: 'USD',
      exchangeMic: 'XNAS',
    });
    await database.insert(persistence.importBatches).values(batch());
    const legacy = fill();
    const fingerprint = domain.tradeFingerprint(legacy);
    await database.insert(persistence.transactions).values({ ...legacy, fingerprint });
    await database.insert(persistence.tradeSources).values({
      sourceTradeId: legacy.id,
      accountId: legacy.accountId,
      externalRef: legacy.externalRef,
      importBatchId: legacy.importBatchId,
      sourceRow: legacy.sourceRow,
      fingerprint,
      transactionId: legacy.id,
    });
    await database.insert(persistence.auditEvents).values({
      id: 'confirmed-import:order-batch-1',
      accountId: 'account-1',
      importBatchId: 'order-batch-1',
      eventType: 'CONFIRMED_IMPORT',
      recordedAt: batch().confirmedAt,
      insertedCount: 1,
    });
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const repository = persistence.createD1TransactionRepository(env.DB);
    expect(await repository.readLedger('account-1')).toMatchObject({
      revision: 1,
      trades: [legacy],
      batches: [batch()],
      aliases: [{ id: 'fill-1', fingerprint }],
    });
    expect(await env.DB.prepare('SELECT fingerprint FROM transactions').first()).toEqual({
      fingerprint,
    });
    expect(await env.DB.prepare('SELECT inserted_count FROM audit_events').first()).toEqual({
      inserted_count: 1,
    });
    await expect(env.DB.prepare('DELETE FROM transactions').run()).rejects.toThrow();
  });

  it('round trips reported economics and null execution facts after repository reload', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    expect(await recordConfirmedTrades(repository, { batch: batch(), trades: [order()] })).toEqual({
      inserted: 1,
      duplicates: 0,
    });
    const reloaded = persistence.createD1TransactionRepository(env.DB);
    const snapshot = await reloaded.readLedger('account-1');
    expect(snapshot.trades).toEqual([order()]);
    expect(snapshot.revision).toBe(1);
    expect(domain.rebuildPositions(snapshot.trades)).toMatchObject([
      { quantity: '3', costBasis: '10.2', realizedPL: '0' },
    ]);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM transactions').first()).toEqual({
      n: 0,
    });
    expect(await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first()).toEqual({
      n: 1,
    });
  });

  it('replays a file and adds cross-file provenance without adding quantity', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    const input = { batch: batch(), trades: [order()] };
    await recordConfirmedTrades(repository, input);
    expect(await recordConfirmedTrades(repository, input)).toEqual({ inserted: 0, duplicates: 1 });
    expect(
      await recordConfirmedTrades(repository, {
        batch: batch('order-batch-2', 'b'),
        trades: [order({ id: 'alias-2', importBatchId: 'order-batch-2' })],
      }),
    ).toEqual({ inserted: 0, duplicates: 1 });
    const snapshot = await persistence
      .createD1TransactionRepository(env.DB)
      .readLedger('account-1');
    expect(snapshot.revision).toBe(2);
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.aliases).toMatchObject([
      { id: 'order-1', importBatchId: 'order-batch-1' },
      { id: 'alias-2', importBatchId: 'order-batch-2' },
    ]);
    expect(snapshot.batches).toHaveLength(2);
  });

  it('retains conflict identity across files and rolls back direct adapter changes', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, { batch: batch(), trades: [order()] });
    await recordConfirmedTrades(repository, {
      batch: batch('order-batch-2', 'b'),
      trades: [order({ id: 'alias-2', importBatchId: 'order-batch-2' })],
    });
    const reloaded = persistence.createD1TransactionRepository(env.DB);
    const changed = order({
      id: 'alias-2',
      grossAmount: '11',
      netAmount: '11.2',
      importBatchId: 'order-batch-3',
    });
    await expect(
      recordConfirmedTrades(reloaded, {
        batch: batch('order-batch-3', 'c'),
        trades: [changed],
      }),
    ).rejects.toBeInstanceOf(domain.LedgerConflictError);
    await expect(
      reloaded.appendBatch(batch('order-batch-3', 'c'), [changed], 2, [changed]),
    ).rejects.toThrow();
    const snapshot = await reloaded.readLedger('account-1');
    expect(snapshot.revision).toBe(2);
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.aliases).toHaveLength(2);
    expect(snapshot.batches).toHaveLength(2);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first()).toEqual({
      n: 2,
    });
  });

  it('rejects stale revision and invalid foreign keys without partial writes', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await repository.appendBatch(batch(), [order()], 0, [order()]);
    await expect(
      repository.appendBatch(batch('order-batch-2', 'b'), [], 0, []),
    ).rejects.toBeInstanceOf(domain.LedgerRevisionConflictError);
    const missing = order({ id: 'missing', securityId: 'missing', importBatchId: 'order-batch-2' });
    await expect(
      repository.appendBatch(batch('order-batch-2', 'b'), [missing], 1, [missing]),
    ).rejects.toThrow();
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.batches).toHaveLength(1);
    expect(snapshot.aliases).toHaveLength(1);
  });

  it('protects date order canonical rows and source evidence against mutation', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await repository.appendBatch(batch(), [order()], 0, [order()]);
    for (const statement of [
      "UPDATE document_orders SET gross_amount='9'",
      'DELETE FROM document_orders',
      "UPDATE document_order_sources SET external_ref='changed'",
      'DELETE FROM document_order_sources',
    ])
      await expect(env.DB.prepare(statement).run()).rejects.toThrow();
    expect((await repository.readLedger('account-1')).trades).toEqual([order()]);
  });

  it('rejects an unlinked mixed-precision batch atomically in either row order', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    const sale = order({
      id: 'sale-1',
      side: 'SELL',
      tradeDate: '2026-11-06',
      quantity: '1',
      unitPrice: '5',
      grossAmount: '5',
      netAmount: '4.8',
      sourceRow: 2,
    });
    for (const trades of [
      [fill(), sale],
      [sale, fill()],
    ]) {
      await expect(repository.appendBatch(batch(), trades, 0, trades)).rejects.toThrow();
      expect(await repository.readLedger('account-1')).toEqual({
        revision: 0,
        trades: [],
        batches: [],
        aliases: [],
      });
      expect(await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first()).toEqual({
        n: 0,
      });
    }
  });

  it.each(['FILL_FIRST', 'ORDER_FIRST'] as const)(
    'rejects unlinked precision across files and days: %s',
    async (direction) => {
      const repository = persistence.createD1TransactionRepository(env.DB);
      const first = direction === 'FILL_FIRST' ? fill() : order();
      const second =
        direction === 'FILL_FIRST'
          ? order({ importBatchId: 'order-batch-2' })
          : fill({ importBatchId: 'order-batch-2' });
      await repository.appendBatch(batch(), [first], 0, [first]);
      await expect(
        repository.appendBatch(batch('order-batch-2', 'b'), [second], 1, [second]),
      ).rejects.toThrow();
      const snapshot = await persistence
        .createD1TransactionRepository(env.DB)
        .readLedger('account-1');
      expect(snapshot).toMatchObject({ revision: 1, trades: [first], batches: [batch()] });
      expect(snapshot.aliases).toHaveLength(1);
      expect(await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first()).toEqual({
        n: 1,
      });
    },
  );

  it('allows distinct securities to use different evidence precision', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await persistence.createDatabase(env.DB).insert(persistence.securities).values({
      id: 'security-2',
      symbol: 'MOCK2',
      market: 'US',
      currency: 'USD',
      exchangeMic: 'XNAS',
    });
    const other = order({ securityId: 'security-2', sourceRow: 2 });
    expect(
      await recordConfirmedTrades(repository, { batch: batch(), trades: [fill(), other] }),
    ).toEqual({
      inserted: 2,
      duplicates: 0,
    });
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.trades).toEqual([fill(), other]);
    expect(snapshot.revision).toBe(1);
  });

  it('keeps confirmed same-day summaries when cost ordering is unavailable', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    const sale = order({
      id: 'same-day-sale',
      side: 'SELL',
      quantity: '1',
      unitPrice: '10',
      grossAmount: '10',
      netAmount: '9.8',
      sourceRow: 2,
      externalRef: 'mock-order:2026-11-05:security-1:sale',
    });
    expect(
      await recordConfirmedTrades(repository, {
        batch: batch(),
        trades: [order(), sale],
      }),
    ).toEqual({ inserted: 2, duplicates: 0 });
    const snapshot = await persistence
      .createD1TransactionRepository(env.DB)
      .readLedger('account-1');
    expect(snapshot.trades).toHaveLength(2);
    expect(domain.rebuildPositions(snapshot.trades)).toMatchObject([
      {
        quantity: '2',
        costBasis: null,
        realizedPL: null,
        calculationStatus: 'AMBIGUOUS_DOCUMENT_ORDER',
      },
    ]);
  });

  it('rejects canonical identity collisions between evidence precisions at the SQL boundary', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await repository.appendBatch(batch(), [order()], 0, [order()]);
    await persistence.createDatabase(env.DB).insert(persistence.securities).values({
      id: 'security-2',
      symbol: 'MOCK2',
      market: 'US',
      currency: 'USD',
      exchangeMic: 'XNAS',
    });
    const duplicateId = fill({
      id: 'order-1',
      securityId: 'security-2',
      importBatchId: 'order-batch-2',
    });
    await expect(
      repository.appendBatch(batch('order-batch-2', 'b'), [duplicateId], 1, [duplicateId]),
    ).rejects.toThrow();
    const duplicateReference = fill({
      securityId: 'security-2',
      externalRef: order().externalRef,
      importBatchId: 'order-batch-2',
    });
    await expect(
      repository.appendBatch(batch('order-batch-2', 'b'), [duplicateReference], 1, [
        duplicateReference,
      ]),
    ).rejects.toThrow();
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.trades).toEqual([order()]);
    expect(snapshot.batches).toHaveLength(1);
    expect(snapshot.aliases).toHaveLength(1);
  });
});
