import { describe, expect, it } from 'vitest';
import {
  LedgerRevisionConflictError,
  LedgerConflictError,
  tradeFingerprint,
  type ImportBatch,
  type DocumentOrderTrade,
  type LedgerSnapshot,
  type Trade,
  type TransactionRepository,
} from '@portfolio/domain';
import { recordConfirmedTrades } from './record-confirmed-trades.js';

const batch: ImportBatch = {
  id: 'MOCK-batch',
  accountId: 'MOCK-account',
  documentSha256: 'a'.repeat(64),
  parserVersion: 'MOCK-v1',
  confirmedAt: '2026-11-06T18:00:00.000Z',
};
const trade: Trade = {
  id: 'MOCK-trade',
  accountId: 'MOCK-account',
  securityId: 'MOCK-security',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  status: 'FILLED',
  side: 'BUY',
  executedAt: '2026-11-06T15:00:00.000Z',
  sequence: 0,
  tradeDate: '2026-11-06',
  quantity: '1',
  executionPrice: '10',
  fee: '0',
  tax: '0',
  feeCurrency: 'USD',
  externalRef: null,
  importBatchId: 'MOCK-batch',
  sourceRow: 1,
};
const documentOrder: DocumentOrderTrade = {
  ...trade,
  id: 'MOCK-document-order',
  precision: 'DOCUMENT_DATE',
  status: 'CONFIRMED',
  executedAt: null,
  sequence: null,
  executionPrice: null,
  unitPrice: '10',
  grossAmount: '10',
  netAmount: '10',
  externalRef: 'MOCK-order-reference',
  sourceRow: 2,
};

// This port double models another writer advancing an otherwise unchanged ledger.
// Its stored state, rather than a mock return value, is the result being verified.
class ContendedRepository implements TransactionRepository {
  snapshot: LedgerSnapshot = { revision: 0, trades: [], batches: [], aliases: [] };
  reads = 0;
  writes = 0;
  constructor(
    private readonly conflicts: number,
    private readonly otherError?: Error,
  ) {}

  async readLedger(): Promise<LedgerSnapshot> {
    this.reads += 1;
    return this.snapshot;
  }

  async appendBatch(
    batch: ImportBatch,
    trades: readonly Trade[],
    revision: number,
    sources: readonly Trade[],
  ): Promise<void> {
    this.writes += 1;
    if (this.otherError) throw this.otherError;
    if (this.writes <= this.conflicts) {
      this.snapshot = { ...this.snapshot, revision: this.snapshot.revision + 1 };
      throw new LedgerRevisionConflictError();
    }
    if (revision !== this.snapshot.revision) throw new Error('Use case reused a stale snapshot');
    this.snapshot = {
      revision: revision + 1,
      trades: [...this.snapshot.trades, ...trades],
      batches: [...this.snapshot.batches, batch],
      aliases: [
        ...this.snapshot.aliases,
        ...sources.map((trade) => ({
          id: trade.id,
          accountId: trade.accountId,
          externalRef: trade.externalRef,
          importBatchId: trade.importBatchId,
          sourceRow: trade.sourceRow,
          fingerprint: tradeFingerprint(trade),
        })),
      ],
    };
  }
}

describe('confirmed import contention', () => {
  it.each([
    [trade, documentOrder],
    [documentOrder, trade],
    [trade, { ...documentOrder, tradeDate: '2026-11-07' }],
  ] as const)(
    'blocks unlinked execution/order evidence for the same security without writing (%#)',
    async (existing, incoming) => {
      const repository = new ContendedRepository(0);
      repository.snapshot = { revision: 1, trades: [existing], batches: [], aliases: [] };
      await expect(
        recordConfirmedTrades(repository, { batch, trades: [incoming] }),
      ).rejects.toBeInstanceOf(LedgerConflictError);
      expect(repository.snapshot).toEqual({
        revision: 1,
        trades: [existing],
        batches: [],
        aliases: [],
      });
      expect(repository.writes).toBe(0);
    },
  );

  it('blocks mixed evidence in the first batch without writing either row', async () => {
    const repository = new ContendedRepository(0);
    await expect(
      recordConfirmedTrades(repository, { batch, trades: [trade, documentOrder] }),
    ).rejects.toBeInstanceOf(LedgerConflictError);
    expect(repository.snapshot).toEqual({ revision: 0, trades: [], batches: [], aliases: [] });
    expect(repository.writes).toBe(0);
  });

  it('allows documentary orders for a different security from existing execution evidence', async () => {
    const repository = new ContendedRepository(0);
    repository.snapshot = { revision: 1, trades: [trade], batches: [], aliases: [] };
    await expect(
      recordConfirmedTrades(repository, {
        batch,
        trades: [{ ...documentOrder, securityId: 'MOCK-other-security' }],
      }),
    ).resolves.toEqual({ inserted: 1, duplicates: 0 });
    expect(repository.snapshot.trades).toHaveLength(2);
  });

  it.each([-1, 0.5, NaN, Infinity])(
    'rejects an invalid expected review revision %s before writing',
    async (expectedRevision) => {
      const repository = new ContendedRepository(0);
      await expect(
        recordConfirmedTrades(repository, { batch, trades: [trade] }, expectedRevision),
      ).rejects.toThrow();
      expect(repository.snapshot).toEqual({ revision: 0, trades: [], batches: [], aliases: [] });
    },
  );
  it('reloads a new snapshot after revision conflicts before persisting on its third attempt', async () => {
    const repository = new ContendedRepository(2);
    expect(await recordConfirmedTrades(repository, { batch, trades: [trade] })).toEqual({
      inserted: 1,
      duplicates: 0,
    });
    expect(repository.snapshot).toMatchObject({
      revision: 3,
      trades: [trade],
      batches: [batch],
      aliases: [{ id: 'MOCK-trade', sourceRow: 1 }],
    });
    expect(repository.reads).toBe(3);
  });

  it('stops after three contended snapshots without adding a trade or batch', async () => {
    const repository = new ContendedRepository(100);
    await expect(
      recordConfirmedTrades(repository, { batch, trades: [trade] }),
    ).rejects.toBeInstanceOf(LedgerRevisionConflictError);
    expect(repository.snapshot).toEqual({ revision: 3, trades: [], batches: [], aliases: [] });
    expect(repository.reads).toBe(3);
    expect(repository.writes).toBe(3);
  });

  it('surfaces a nonrevision persistence error without retrying it', async () => {
    const repository = new ContendedRepository(0, new Error('Unique identity violation'));
    await expect(recordConfirmedTrades(repository, { batch, trades: [trade] })).rejects.toThrow(
      'Unique identity violation',
    );
    expect(repository.snapshot).toEqual({ revision: 0, trades: [], batches: [], aliases: [] });
    expect(repository.reads).toBe(1);
    expect(repository.writes).toBe(1);
  });
});
