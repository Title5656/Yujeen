import { env } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import * as persistence from '@portfolio/database';
import * as domain from '@portfolio/domain';
import { recordConfirmedTrades } from '../src/modules/transactions/record-confirmed-trades.js';

const sha = (character: string) => character.repeat(64);
const batch = (id = 'batch-1', hash = sha('a')) => ({
  id,
  accountId: 'account-1',
  documentSha256: hash,
  parserVersion: 'mock-v1',
  confirmedAt: '2026-11-06T18:00:00.000Z',
});
const trade = (overrides: Partial<domain.ExecutionTrade> = {}): domain.ExecutionTrade => ({
  id: 'trade-1',
  accountId: 'account-1',
  securityId: 'security-1',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  status: 'FILLED',
  side: 'BUY',
  executedAt: '2026-11-06T15:00:00.000Z',
  sequence: 0,
  tradeDate: '2026-11-06',
  quantity: '10',
  executionPrice: '100',
  fee: '1',
  tax: '0',
  feeCurrency: 'USD',
  externalRef: 'mock-fill-1',
  importBatchId: 'batch-1',
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

describe('confirmed D1 ledger', () => {
  it('persists exact decimals and provenance and rebuilds from an atomic snapshot', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    expect(await recordConfirmedTrades(repository, { batch: batch(), trades: [trade()] })).toEqual({
      inserted: 1,
      duplicates: 0,
    });
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.trades).toEqual([trade()]);
    expect(snapshot.batches).toEqual([batch()]);
    const positions = domain.rebuildPositions(snapshot.trades);
    expect(positions).toMatchObject([{ quantity: '10', costBasis: '1001', realizedPL: '0' }]);
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first<{ n: number }>())?.n,
    ).toBe(1);
  });

  it('replays a whole file without changing ledger revision or creation audit', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    const input = { batch: batch(), trades: [trade()] };
    await recordConfirmedTrades(repository, input);
    expect(await recordConfirmedTrades(repository, input)).toEqual({ inserted: 0, duplicates: 1 });
    expect((await repository.readLedger('account-1')).revision).toBe(1);
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first<{ n: number }>())?.n,
    ).toBe(1);
  });

  it('records new document provenance for a duplicate fill without appending the fill', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, { batch: batch(), trades: [trade()] });
    expect(
      await recordConfirmedTrades(repository, {
        batch: batch('batch-2', sha('b')),
        trades: [trade({ id: 'trade-2', importBatchId: 'batch-2' })],
      }),
    ).toEqual({ inserted: 0, duplicates: 1 });
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.batches).toHaveLength(2);
    expect(snapshot.revision).toBe(2);
  });

  it('remembers duplicate IDs and enriched external references across repository instances', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, {
      batch: batch(),
      trades: [trade({ externalRef: null })],
    });
    await recordConfirmedTrades(repository, {
      batch: batch('batch-2', sha('b')),
      trades: [
        trade({ id: 'duplicate-alias', externalRef: 'known-later', importBatchId: 'batch-2' }),
      ],
    });
    const reloaded = persistence.createD1TransactionRepository(env.DB);
    expect((await reloaded.readLedger('account-1')).aliases).toMatchObject([
      { id: 'trade-1', externalRef: null, importBatchId: 'batch-1', sourceRow: 1 },
      { id: 'duplicate-alias', externalRef: 'known-later', importBatchId: 'batch-2', sourceRow: 1 },
    ]);
    await expect(
      recordConfirmedTrades(reloaded, {
        batch: batch('batch-3', sha('c')),
        trades: [
          trade({
            id: 'new-id',
            executionPrice: '101',
            externalRef: 'known-later',
            importBatchId: 'batch-3',
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(domain.LedgerConflictError);
    await expect(
      recordConfirmedTrades(reloaded, {
        batch: batch('batch-3', sha('c')),
        trades: [
          trade({
            id: 'duplicate-alias',
            executionPrice: '101',
            externalRef: null,
            importBatchId: 'batch-3',
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(domain.LedgerConflictError);
    const snapshot = await reloaded.readLedger('account-1');
    expect(snapshot.revision).toBe(2);
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.batches).toHaveLength(2);
  });

  it('rejects a same-document replay that silently introduces a new ID or external reference', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, {
      batch: batch(),
      trades: [trade({ externalRef: null })],
    });
    await expect(
      recordConfirmedTrades(repository, {
        batch: batch(),
        trades: [trade({ externalRef: 'learned-without-write' })],
      }),
    ).rejects.toBeInstanceOf(domain.LedgerConflictError);
    await expect(
      recordConfirmedTrades(repository, {
        batch: batch('regenerated-id'),
        trades: [trade({ id: 'new-id', externalRef: null, importBatchId: 'regenerated-id' })],
      }),
    ).rejects.toBeInstanceOf(domain.LedgerConflictError);
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.aliases).toHaveLength(1);
    expect(snapshot.aliases[0]?.externalRef).toBeNull();
  });

  it('rolls back direct adapter appends that reuse a persisted alias with changed economics', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, {
      batch: batch(),
      trades: [trade({ externalRef: null })],
    });
    await recordConfirmedTrades(repository, {
      batch: batch('batch-2', sha('b')),
      trades: [trade({ id: 'learned-id', externalRef: 'learned-ref', importBatchId: 'batch-2' })],
    });
    const changedReference = trade({
      id: 'new-id',
      executionPrice: '101',
      externalRef: 'learned-ref',
      importBatchId: 'batch-3',
    });
    await expect(
      repository.appendBatch(batch('batch-3', sha('c')), [changedReference], 2, [changedReference]),
    ).rejects.toThrow();
    const changedId = trade({
      id: 'learned-id',
      executionPrice: '101',
      externalRef: null,
      importBatchId: 'batch-3',
    });
    await expect(
      repository.appendBatch(batch('batch-3', sha('c')), [changedId], 2, [changedId]),
    ).rejects.toThrow();
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(2);
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.aliases).toHaveLength(2);
  });

  it('rejects changed file replay and conflicting external references without writes', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, { batch: batch(), trades: [trade()] });
    await expect(
      recordConfirmedTrades(repository, {
        batch: batch(),
        trades: [trade({ id: 'trade-new', externalRef: 'mock-fill-new', sequence: 1 })],
      }),
    ).rejects.toThrow();
    await expect(
      recordConfirmedTrades(repository, {
        batch: batch('batch-2', sha('b')),
        trades: [trade({ id: 'trade-2', importBatchId: 'batch-2', executionPrice: '101' })],
      }),
    ).rejects.toThrow();
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.batches).toHaveLength(1);
  });

  it('validates an entire input before persisting any batch', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await expect(
      recordConfirmedTrades(repository, {
        batch: batch(),
        trades: [trade(), trade({ id: 'invalid', quantity: '0', sourceRow: 2 })],
      }),
    ).rejects.toThrow();
    expect(await repository.readLedger('account-1')).toEqual({
      revision: 0,
      trades: [],
      batches: [],
      aliases: [],
    });
  });

  it('rolls back batch metadata and revision when one persisted row violates a foreign key', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await expect(
      repository.appendBatch(batch(), [trade({ securityId: 'missing' })], 0, [
        trade({ securityId: 'missing' }),
      ]),
    ).rejects.toThrow();
    expect(await repository.readLedger('account-1')).toEqual({
      revision: 0,
      trades: [],
      batches: [],
      aliases: [],
    });
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it('rejects an outdated revision and never writes a partial second batch', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await repository.appendBatch(batch(), [trade()], 0, [trade()]);
    await expect(
      repository.appendBatch(batch('batch-2', sha('b')), [], 0, []),
    ).rejects.toBeInstanceOf(domain.LedgerRevisionConflictError);
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(1);
    expect(snapshot.batches).toHaveLength(1);
  });

  it('allows only one of two simultaneous sales that together oversell the holding', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await recordConfirmedTrades(repository, { batch: batch(), trades: [trade()] });
    const sell = (id: string, sequence: number, importBatchId: string) =>
      trade({
        id,
        side: 'SELL',
        quantity: '6',
        executedAt: '2026-11-06T16:00:00.000Z',
        sequence,
        externalRef: id,
        importBatchId,
      });
    const results = await Promise.allSettled([
      recordConfirmedTrades(repository, {
        batch: batch('batch-2', sha('b')),
        trades: [sell('sell-1', 0, 'batch-2')],
      }),
      recordConfirmedTrades(repository, {
        batch: batch('batch-3', sha('c')),
        trades: [sell('sell-2', 1, 'batch-3')],
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const snapshot = await repository.readLedger('account-1');
    expect(snapshot.revision).toBe(2);
    expect(snapshot.trades).toHaveLength(2);
    expect(domain.rebuildPositions(snapshot.trades)).toMatchObject([
      { quantity: '4', costBasis: '400.4', realizedPL: '-1.6' },
    ]);
  });

  it('enforces raw uniqueness, foreign keys and append-only rows', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await repository.appendBatch(batch(), [trade()], 0, [trade()]);
    await expect(
      env.DB.prepare("UPDATE transactions SET quantity='1' WHERE id='trade-1'").run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("DELETE FROM transactions WHERE id='trade-1'").run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE import_batches SET parser_version='changed' WHERE id='batch-1'").run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("DELETE FROM import_batches WHERE id='batch-1'").run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare('UPDATE audit_events SET inserted_count=0').run(),
    ).rejects.toThrow();
    await expect(env.DB.prepare('DELETE FROM audit_events').run()).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE trade_sources SET external_ref='changed'").run(),
    ).rejects.toThrow();
    await expect(env.DB.prepare('DELETE FROM trade_sources').run()).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO import_batches (id,account_id,document_sha256,parser_version,confirmed_at) VALUES ('duplicate','account-1',?,'mock-v1','2026-11-06T18:00:00.000Z')",
      )
        .bind(sha('a'))
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO import_batches (id,account_id,document_sha256,parser_version,confirmed_at) VALUES ('orphan','missing',?,'mock-v1','2026-11-06T18:00:00.000Z')",
      )
        .bind(sha('b'))
        .run(),
    ).rejects.toThrow();
  });

  it('enforces independent trade identity and account/security/batch foreign keys in SQL', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    await repository.appendBatch(batch(), [trade()], 0, [trade()]);
    const database = persistence.createDatabase(env.DB);
    await database
      .insert(persistence.accounts)
      .values({ id: 'account-2', broker: 'DIME', market: 'US', currency: 'USD' });
    await database.insert(persistence.securities).values({
      id: 'security-th',
      symbol: 'MOCKTH',
      market: 'TH',
      currency: 'THB',
      exchangeMic: 'XBKK',
    });
    await database
      .insert(persistence.importBatches)
      .values({ ...batch('batch-other', sha('d')), accountId: 'account-2' });
    const insertCopy = async (changes: Partial<typeof persistence.transactions.$inferInsert>) => {
      const existing = await database.select().from(persistence.transactions);
      const row = existing[0];
      if (!row) throw new Error('Fixture transaction missing');
      return database.insert(persistence.transactions).values({
        ...row,
        id: 'copy',
        externalRef: null,
        sourceRow: 2,
        fingerprint: 'MOCK-copy',
        ...changes,
      });
    };
    await expect(insertCopy({ id: 'trade-1' })).rejects.toThrow();
    await expect(insertCopy({ externalRef: 'mock-fill-1' })).rejects.toThrow();
    await expect(insertCopy({ fingerprint: domain.tradeFingerprint(trade()) })).rejects.toThrow();
    await expect(insertCopy({ sourceRow: 1 })).rejects.toThrow();
    await expect(insertCopy({ accountId: 'missing' })).rejects.toThrow();
    await expect(insertCopy({ securityId: 'security-th' })).rejects.toThrow();
    await expect(insertCopy({ importBatchId: 'batch-other' })).rejects.toThrow();
    expect((await repository.readLedger('account-1')).trades).toHaveLength(1);
  });

  it('validates raw stored financial fields rather than trusting the database row', async () => {
    const repository = persistence.createD1TransactionRepository(env.DB);
    const database = persistence.createDatabase(env.DB);
    await database.insert(persistence.importBatches).values(batch());
    await database
      .insert(persistence.transactions)
      .values({ ...trade(), quantity: '-1', fingerprint: 'MOCK-corrupt' });
    await expect(repository.readLedger('account-1')).rejects.toThrow();
  });
});
