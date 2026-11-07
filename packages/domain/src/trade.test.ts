import { describe, expect, it } from 'vitest';
import {
  dimeUsTradeDate,
  normalizeExecutedAt,
  tradeFingerprint,
  validateTrade,
  type Trade,
} from './trade.js';

const filled: Trade = {
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
  executionPrice: '100.000',
  fee: '0.10',
  tax: '0.00',
  feeCurrency: 'USD',
  externalRef: 'mock-external-1',
  importBatchId: 'mock-batch-1',
  sourceRow: 1,
};

describe('confirmed trade validation', () => {
  it('normalizes decimals and offset timestamps without mutating input', () => {
    expect(validateTrade(filled)).toEqual({
      ...filled,
      executedAt: '2026-01-02T15:30:00.000Z',
      quantity: '1.25',
      executionPrice: '100',
      fee: '0.1',
      tax: '0',
    });
    expect(filled.executedAt).toBe('2026-01-02T10:30:00-05:00');
  });

  it.each([
    { quantity: '0' },
    { quantity: '-1' },
    { executionPrice: '0' },
    { executionPrice: '1e2' },
    { fee: '-0.1' },
    { tax: '-0.1' },
    { fee: undefined },
    { executionPrice: undefined },
    { status: 'PENDING' },
    { status: 'CANCELLED' },
    { market: 'TH' },
    { currency: 'THB' },
    { feeCurrency: 'THB' },
    { quantity: '1000000000000000000' },
    { quantity: '0.0000000000001' },
    { sequence: -1 },
    { sequence: 0.5 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { sourceRow: 0 },
    { accountId: '' },
    { externalRef: ' ' },
    { executedAt: '2026-02-29T10:30:00-05:00', tradeDate: '2026-03-01' },
    { executedAt: '2026-04-31T10:30:00-04:00', tradeDate: '2026-05-01' },
    { executedAt: '2026-01-02T24:00:00Z' },
    { executedAt: '2026-01-02T10:30:60Z' },
    { executedAt: '2026-01-02T10:30:00' },
    { executedAt: '2026-01-02T10:30:00.0001Z' },
    { executedAt: '2026-01-02T10:30:00+24:00' },
    { tradeDate: '2026-01-03' },
  ])('rejects invalid or incomplete confirmed trade %j', (patch) => {
    expect(() => validateTrade({ ...filled, ...patch } as Trade)).toThrow();
  });

  it('uses the New York date across UTC midnight and DST', () => {
    expect(dimeUsTradeDate('2026-01-03T01:00:00Z')).toBe('2026-01-02');
    expect(dimeUsTradeDate('2026-07-03T03:59:59Z')).toBe('2026-07-02');
    expect(dimeUsTradeDate('2026-07-03T04:00:00Z')).toBe('2026-07-03');
    expect(normalizeExecutedAt('2024-02-29T23:30:12.125+07:00')).toBe('2024-02-29T16:30:12.125Z');
  });
});

describe('canonical trade fingerprint', () => {
  it('identifies economic replays across IDs, provenance and equivalent representations', () => {
    const replay = {
      ...filled,
      id: 'mock-other-id',
      externalRef: null,
      importBatchId: 'mock-other-document',
      sourceRow: 12,
      executedAt: '2026-01-02T15:30:00Z',
      quantity: '1.25',
      executionPrice: '100',
      fee: '0.1',
      tax: '0',
    };
    expect(tradeFingerprint(filled)).toBe(tradeFingerprint(replay));
    expect(tradeFingerprint(filled)).toBe(
      'trade:v1:["DIME","US","mock-account","mock-us-aapl","BUY","2026-01-02T15:30:00.000Z",0,"1.25","100","0.1","0","USD","USD"]',
    );
  });

  it.each([
    { accountId: 'mock-second-account' },
    { securityId: 'mock-second-security' },
    { side: 'SELL' as const },
    { executedAt: '2026-01-02T10:30:01-05:00' },
    { sequence: 1 },
    { quantity: '1.26' },
    { executionPrice: '101' },
    { fee: '0.2' },
    { tax: '0.1' },
  ])('distinguishes changes to economic identity %j', (patch) => {
    expect(tradeFingerprint({ ...filled, ...patch })).not.toBe(tradeFingerprint(filled));
  });
});
