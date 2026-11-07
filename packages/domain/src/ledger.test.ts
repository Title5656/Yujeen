import { describe, expect, it } from 'vitest';
import { LedgerConflictError, mergeLedger } from './ledger.js';
import type { Trade, TradeAlias } from './trade.js';

const fill: Trade = {
  id: 'mock-fill-1',
  accountId: 'mock-account',
  securityId: 'mock-us-aapl',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  status: 'FILLED',
  side: 'BUY',
  executedAt: '2026-01-02T15:30:00.000Z',
  sequence: 0,
  tradeDate: '2026-01-02',
  quantity: '1',
  executionPrice: '100',
  fee: '0',
  tax: '0',
  feeCurrency: 'USD',
  externalRef: 'mock-ref-1',
  importBatchId: 'mock-batch-1',
  sourceRow: 1,
};

describe('ledger identity and idempotency', () => {
  it('adds distinct fills, normalizes them, and preserves inputs', () => {
    const incoming = [{ ...fill, quantity: '1.000' }];
    expect(mergeLedger([], incoming)).toEqual({ added: [fill], duplicates: 0 });
    expect(incoming[0]?.quantity).toBe('1.000');
  });

  it('counts same-file and cross-file economic replays without adding fills', () => {
    expect(
      mergeLedger(
        [fill],
        [
          fill,
          { ...fill, id: 'mock-fill-copy', importBatchId: 'mock-batch-2', sourceRow: 4 },
          {
            ...fill,
            id: 'mock-fill-without-ref',
            externalRef: null,
            importBatchId: 'mock-batch-3',
            sourceRow: 5,
          },
        ],
      ),
    ).toEqual({ added: [], duplicates: 3 });
  });

  it('keeps identical-looking fills distinguished by execution sequence', () => {
    const second = {
      ...fill,
      id: 'mock-fill-2',
      sequence: 1,
      externalRef: 'mock-ref-2',
      sourceRow: 2,
    };
    expect(mergeLedger([fill], [second])).toEqual({ added: [second], duplicates: 0 });
  });

  it.each([
    { executionPrice: '101' },
    { id: 'mock-new-id', executionPrice: '101' },
    { id: 'mock-new-id', externalRef: 'mock-new-ref', executionPrice: '101' },
    {
      id: 'mock-new-id',
      externalRef: 'mock-new-ref',
      importBatchId: 'mock-new-batch',
      sourceRow: 2,
    },
  ])('rejects changed or ambiguous fills that reuse identity %j', (patch) => {
    expect(() => mergeLedger([fill], [{ ...fill, ...patch }])).toThrow(LedgerConflictError);
  });

  it('scopes external references to accounts', () => {
    const otherAccount = {
      ...fill,
      id: 'mock-second-account-fill',
      accountId: 'mock-second-account',
      importBatchId: 'mock-second-account-batch',
    };
    expect(mergeLedger([fill], [otherAccount])).toEqual({ added: [otherAccount], duplicates: 0 });
  });

  it('rejects duplicates already present in the supposedly clean ledger', () => {
    expect(() => mergeLedger([fill, fill], [])).toThrow(LedgerConflictError);
  });

  it('detects conflicts against aliases introduced by duplicate rows in the same batch', () => {
    const replay = { ...fill, id: 'mock-copy', importBatchId: 'mock-copy-batch', sourceRow: 7 };
    expect(() =>
      mergeLedger([fill], [replay, { ...replay, externalRef: null, quantity: '2' }]),
    ).toThrow(LedgerConflictError);
  });

  it('retains external identity observed on a duplicate without one in the original', () => {
    const withoutReference = { ...fill, externalRef: null };
    expect(() =>
      mergeLedger(
        [withoutReference],
        [
          { ...fill, id: 'mock-copy', importBatchId: 'mock-copy-batch' },
          {
            ...fill,
            id: 'mock-another-copy',
            externalRef: 'mock-distinct-fill',
            importBatchId: 'mock-another-batch',
          },
        ],
      ),
    ).toThrow(LedgerConflictError);
  });

  const persistedAlias: TradeAlias = {
    id: 'mock-enriched-id',
    accountId: 'mock-account',
    externalRef: 'mock-enriched-reference',
    importBatchId: 'mock-enriched-batch',
    sourceRow: 7,
    fingerprint:
      'trade:v1:["DIME","US","mock-account","mock-us-aapl","BUY","2026-01-02T15:30:00.000Z",0,"1","100","0","0","USD","USD"]',
  };

  it.each([
    { externalRef: 'mock-enriched-reference' },
    { id: 'mock-enriched-id' },
    { importBatchId: 'mock-enriched-batch', sourceRow: 7 },
  ])('rejects changed economics through persisted alias identity %j', (patch) => {
    const changed: Trade = {
      ...fill,
      id: 'mock-new-id',
      externalRef: null,
      importBatchId: 'mock-new-batch',
      sourceRow: 9,
      executionPrice: '101',
      ...patch,
    };
    expect(() =>
      mergeLedger([{ ...fill, externalRef: null }], [changed], [persistedAlias]),
    ).toThrow(LedgerConflictError);
  });

  it('detects a conflicting external reference learned from persisted duplicate provenance', () => {
    const differentReference: Trade = {
      ...fill,
      id: 'mock-new-id',
      externalRef: 'mock-different-reference',
      importBatchId: 'mock-new-batch',
    };
    expect(() =>
      mergeLedger([{ ...fill, externalRef: null }], [differentReference], [persistedAlias]),
    ).toThrow(LedgerConflictError);
  });

  it('counts unchanged alias replays once without returning provenance as ledger trades', () => {
    const replay: Trade = {
      ...fill,
      id: 'mock-enriched-id',
      externalRef: 'mock-enriched-reference',
      importBatchId: 'mock-enriched-batch',
      sourceRow: 7,
    };
    expect(mergeLedger([{ ...fill, externalRef: null }], [replay], [persistedAlias])).toEqual({
      added: [],
      duplicates: 1,
    });
    expect(mergeLedger([{ ...fill, externalRef: null }], [], [persistedAlias])).toEqual({
      added: [],
      duplicates: 0,
    });
  });

  it.each([
    { id: '' },
    { accountId: 'mock-wrong-account' },
    { externalRef: '' },
    { sourceRow: 0 },
    { sourceRow: 1.5 },
    { fingerprint: 'trade:v1:unknown' },
  ])('rejects malformed or orphaned persisted aliases %j', (patch) => {
    expect(() =>
      mergeLedger([{ ...fill, externalRef: null }], [], [{ ...persistedAlias, ...patch }]),
    ).toThrow(LedgerConflictError);
  });
});
