import { describe, expect, it } from 'vitest';
import { ConfirmedTradeBatchSchema, ImportBatchSchema, TradeSchema } from './trade.js';

const trade = {
  id: 'mock-fill-1',
  accountId: 'mock-account',
  securityId: 'mock-us-aapl',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  status: 'FILLED',
  side: 'BUY',
  executedAt: '2026-01-02T10:30:00-05:00',
  sequence: 0,
  tradeDate: '2026-01-02',
  quantity: '1.2500',
  executionPrice: '100.00',
  fee: '0.10',
  tax: '0.00',
  feeCurrency: 'USD',
  externalRef: null,
  importBatchId: 'mock-batch-1',
  sourceRow: 1,
};
const batch = {
  id: 'mock-batch-1',
  accountId: 'mock-account',
  documentSha256: 'a'.repeat(64),
  parserVersion: 'mock-v1',
  confirmedAt: '2026-01-02T17:00:00+00:00',
};

describe('strict confirmed-trade boundary', () => {
  it('normalizes validated decimals and offsets', () => {
    expect(TradeSchema.parse(trade)).toEqual({
      ...trade,
      executedAt: '2026-01-02T15:30:00.000Z',
      quantity: '1.25',
      executionPrice: '100',
      fee: '0.1',
      tax: '0',
    });
  });

  it.each([
    { executionPrice: undefined },
    { fee: undefined },
    { tax: undefined },
    { status: 'PENDING' },
    { status: 'CANCELLED' },
    { market: 'TH' },
    { currency: 'THB' },
    { feeCurrency: 'THB' },
    { side: 'TRANSFER' },
    { quantity: '0' },
    { quantity: '1e3' },
    { executionPrice: '-1' },
    { fee: '-0.01' },
    { quantity: '1.0000000000001' },
    { executionPrice: '1000000000000000000' },
    { sequence: -1 },
    { sequence: 0.5 },
    { sourceRow: 0 },
    { sourceRow: Number.MAX_SAFE_INTEGER + 1 },
    { accountId: '' },
    { externalRef: '' },
    { sourceDocument: 'private-pdf-content' },
    { executedAt: '2026-01-02T10:30:00' },
    { executedAt: '2026-02-29T10:30:00Z', tradeDate: '2026-03-01' },
    { executedAt: '2026-04-31T10:30:00Z', tradeDate: '2026-05-01' },
    { executedAt: '2026-01-02T24:00:00Z' },
    { executedAt: '2026-01-02T10:30:60Z' },
    { executedAt: '2026-01-02T10:30:00.0001Z' },
    { executedAt: '2026-01-02T10:30:00+24:00' },
    { tradeDate: '2026-01-03' },
  ])('rejects incomplete, unsupported or malformed trade %j', (patch) => {
    expect(TradeSchema.safeParse({ ...trade, ...patch }).success).toBe(false);
  });

  it('validates New York trade dates across UTC midnight', () => {
    expect(
      TradeSchema.safeParse({
        ...trade,
        executedAt: '2026-01-03T01:00:00Z',
        tradeDate: '2026-01-02',
      }).success,
    ).toBe(true);
  });
});

describe('confirmed import provenance', () => {
  it('retains only metadata and normalizes confirmation time', () => {
    expect(ImportBatchSchema.parse(batch)).toEqual({
      ...batch,
      confirmedAt: '2026-01-02T17:00:00.000Z',
    });
    expect(ConfirmedTradeBatchSchema.safeParse({ batch, trades: [trade] }).success).toBe(true);
  });

  it.each([
    { documentSha256: 'a'.repeat(63) },
    { documentSha256: 'A'.repeat(64) },
    { documentSha256: 'g'.repeat(64) },
    { parserVersion: '' },
    { confirmedAt: '2026-02-29T15:30:00Z' },
    { confirmedAt: '2026-01-02T17:00:00' },
    { rawDocument: 'private-pdf-content' },
  ])('rejects invalid or excessive import metadata %j', (patch) => {
    expect(ImportBatchSchema.safeParse({ ...batch, ...patch }).success).toBe(false);
  });

  it.each([{ accountId: 'mock-other-account' }, { importBatchId: 'mock-other-batch' }])(
    'rejects trades belonging to another account or batch %j',
    (patch) => {
      expect(
        ConfirmedTradeBatchSchema.safeParse({ batch, trades: [{ ...trade, ...patch }] }).success,
      ).toBe(false);
    },
  );
});
