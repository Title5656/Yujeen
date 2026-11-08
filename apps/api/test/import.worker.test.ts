import { env } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createD1TransactionRepository,
  createDatabase,
  accounts,
  securities,
} from '@portfolio/database';
import { rebuildPositions } from '@portfolio/domain';
import {
  extractedDocument,
  syntheticContext,
  syntheticFill,
  syntheticLines,
} from '../../../tests/fixtures/synthetic-dime.js';
import { previewImport } from '../src/modules/imports/preview-import.js';
import { confirmImport } from '../src/modules/imports/confirm-import.js';

const makeRequest = (rows: Record<string, unknown>[], hash = 'a'.repeat(64)) => ({
  document: extractedDocument(syntheticLines(rows), hash),
  parserId: 'synthetic-dime',
  context: syntheticContext,
});
const review = async (
  repository: ReturnType<typeof createD1TransactionRepository>,
  request: ReturnType<typeof makeRequest>,
) => ({
  request,
  reviewed: true,
  reviewDigest: (await previewImport(repository, request)).reviewDigest,
  reviewedSourceRows: request.document.pages[0]!.lines.slice(1).map((_, index) => index + 1),
  confirmedAt: '2026-01-08T15:00:00Z',
});

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const db = createDatabase(env.DB);
  await db
    .insert(accounts)
    .values({ id: 'mock-account', broker: 'DIME', market: 'US', currency: 'USD' });
  await db.insert(securities).values({
    id: 'mock-security',
    symbol: 'MOCK',
    market: 'US',
    currency: 'USD',
    exchangeMic: 'XNAS',
  });
});

describe('M2 reviewed import into real local D1', () => {
  it('persists multiple buys/partial sale exactly as M1 trades and replays without double counting', async () => {
    const repository = createD1TransactionRepository(env.DB);
    const request = makeRequest([
      syntheticFill(),
      syntheticFill({
        executedAt: '2026-01-06T15:00:00Z',
        sequence: '2',
        quantity: '1',
        executionPrice: '20',
        fee: '0.4',
        tax: '0',
        externalRef: 'mock-fill-2',
      }),
      syntheticFill({
        side: 'SELL',
        executedAt: '2026-01-07T15:00:00Z',
        sequence: '3',
        quantity: '2.5',
        executionPrice: '30',
        fee: '0.5',
        tax: '0.1',
        externalRef: 'mock-fill-3',
      }),
    ]);
    const command = await review(repository, request);
    expect((await repository.readLedger('mock-account')).trades).toEqual([]);
    expect(await confirmImport(repository, command)).toMatchObject({
      inserted: 3,
      duplicates: 0,
      dataMode: 'MOCK',
    });
    const reloaded = createD1TransactionRepository(env.DB);
    const snapshot = await reloaded.readLedger('mock-account');
    expect(snapshot.trades[0]).toMatchObject({
      quantity: '2',
      executionPrice: '10',
      fee: '1',
      tax: '0.2',
      sequence: 1,
      executedAt: '2026-01-05T15:00:00.000Z',
    });
    expect(snapshot.aliases.map((source) => source.sourceRow)).toEqual([1, 2, 3]);
    expect(rebuildPositions(snapshot.trades)).toMatchObject([
      { quantity: '0.5', costBasis: '10.2', realizedPL: '43' },
    ]);
    expect(await confirmImport(reloaded, await review(reloaded, request))).toMatchObject({
      inserted: 0,
      duplicates: 3,
    });
    expect((await reloaded.readLedger('mock-account')).revision).toBe(1);
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first<{ n: number }>())?.n,
    ).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain('YUJEEN_SYNTHETIC_DIME');
  });

  it('detects duplicates in another file and remembers source provenance after reload', async () => {
    const repository = createD1TransactionRepository(env.DB);
    const original = makeRequest([syntheticFill()]);
    await confirmImport(repository, await review(repository, original));
    const copy = makeRequest([syntheticFill()], 'b'.repeat(64));
    expect(await confirmImport(repository, await review(repository, copy))).toMatchObject({
      inserted: 0,
      duplicates: 1,
    });
    const reloaded = createD1TransactionRepository(env.DB);
    const snapshot = await reloaded.readLedger('mock-account');
    expect(snapshot.trades).toHaveLength(1);
    expect(snapshot.batches).toHaveLength(2);
    expect(snapshot.aliases).toHaveLength(2);
    const changed = makeRequest([syntheticFill({ executionPrice: '11' })], 'c'.repeat(64));
    expect((await previewImport(reloaded, changed)).issues).toContain('LEDGER_CONFLICT');
    await expect(confirmImport(reloaded, await review(reloaded, changed))).rejects.toThrow(
      'NEEDS_REVIEW',
    );
    expect((await reloaded.readLedger('mock-account')).revision).toBe(2);
  });

  it('keeps distinct fills of the same order when explicit fill sequences are different', async () => {
    const repository = createD1TransactionRepository(env.DB);
    const request = makeRequest([
      syntheticFill(),
      syntheticFill({ sequence: '2', externalRef: 'mock-fill-2' }),
    ]);
    expect(await confirmImport(repository, await review(repository, request))).toMatchObject({
      inserted: 2,
      duplicates: 0,
    });
    expect(rebuildPositions((await repository.readLedger('mock-account')).trades)).toMatchObject([
      { quantity: '4', costBasis: '42.4' },
    ]);
  });

  it('does not write metadata or valid rows when another row is missing evidence', async () => {
    const repository = createD1TransactionRepository(env.DB);
    const request = makeRequest([
      syntheticFill(),
      syntheticFill({ sequence: null, externalRef: 'mock-fill-2' }),
    ]);
    await expect(confirmImport(repository, await review(repository, request))).rejects.toThrow(
      'NEEDS_REVIEW',
    );
    expect(await repository.readLedger('mock-account')).toEqual({
      revision: 0,
      trades: [],
      batches: [],
      aliases: [],
    });
  });

  it('rolls back the complete import on a stale security mapping foreign-key failure', async () => {
    const repository = createD1TransactionRepository(env.DB);
    const request = makeRequest([
      syntheticFill(),
      syntheticFill({ symbol: 'MOCK-MISSING', sequence: '2', externalRef: 'mock-fill-2' }),
    ]);
    request.context = {
      ...syntheticContext,
      securities: [
        ...syntheticContext.securities,
        { symbol: 'MOCK-MISSING', market: 'US', currency: 'USD', securityId: 'not-in-d1' },
      ],
    };
    const command = await review(repository, request);
    await expect(confirmImport(repository, command)).rejects.toThrow();
    expect(await repository.readLedger('mock-account')).toEqual({
      revision: 0,
      trades: [],
      batches: [],
      aliases: [],
    });
    expect(
      (await env.DB.prepare('SELECT count(*) AS n FROM audit_events').first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it('requires another review if the ledger changed between preview and confirmation', async () => {
    const repository = createD1TransactionRepository(env.DB);
    const request = makeRequest([syntheticFill()]);
    const stale = await review(repository, request);
    const other = makeRequest(
      [syntheticFill({ sequence: '2', externalRef: 'mock-fill-2' })],
      'b'.repeat(64),
    );
    await confirmImport(repository, await review(repository, other));
    await expect(confirmImport(repository, stale)).rejects.toThrow('PREVIEW_CHANGED');
    expect((await repository.readLedger('mock-account')).trades).toHaveLength(1);
  });
});
