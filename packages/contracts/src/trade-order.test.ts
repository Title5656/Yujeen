import { describe, expect, it } from 'vitest';
import { TradeSchema } from './trade.js';

const order = {
  id: 'mock-order-1',
  accountId: 'mock-account',
  securityId: 'mock-us-a',
  broker: 'DIME',
  market: 'US',
  currency: 'USD',
  precision: 'DOCUMENT_DATE',
  status: 'CONFIRMED',
  side: 'BUY',
  executedAt: null,
  sequence: null,
  executionPrice: null,
  tradeDate: '2026-01-05',
  quantity: '3.000',
  unitPrice: '3.3333',
  grossAmount: '10.00',
  netAmount: '10.30',
  fee: '0.20',
  tax: '0.10',
  feeCurrency: 'USD',
  externalRef: 'mock-date-order-reference',
  importBatchId: 'mock-batch',
  sourceRow: 1,
};

describe('confirmed documentary order contract', () => {
  it('accepts exact reported amounts even when rounded unit price does not reproduce gross', () => {
    expect(TradeSchema.parse(order)).toMatchObject({
      quantity: '3',
      grossAmount: '10',
      netAmount: '10.3',
      unitPrice: '3.3333',
      fee: '0.2',
      tax: '0.1',
      executedAt: null,
    });
    expect(TradeSchema.parse({ ...order, side: 'SELL', netAmount: '9.7' })).toMatchObject({
      side: 'SELL',
    });
  });

  it.each([
    { netAmount: '10.300000000001' },
    { side: 'SELL' },
    { externalRef: null },
    { tradeDate: '2026-02-29' },
    { tradeDate: '0000-01-01' },
    { precision: 'FILL' },
    { sequence: 0 },
    { executedAt: '2026-01-05T00:00:00Z' },
    { executionPrice: '3.3333' },
    { extra: 'unreviewed' },
    { fee: '1e2' },
    { grossAmount: 'NaN' },
    { netAmount: '-1' },
    { tax: '0.0000000000001' },
    { netAmount: '1e2' },
    { quantity: '1e2' },
    { fee: 'unknown' },
  ])('rejects mismatches, invented execution fields and unknown data %j', (patch) => {
    expect(TradeSchema.safeParse({ ...order, ...patch }).success).toBe(false);
  });
});
