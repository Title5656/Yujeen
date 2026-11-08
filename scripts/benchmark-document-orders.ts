import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  mergeLedger,
  rebuildPositions,
  type DocumentOrderTrade,
} from '../packages/domain/dist/index.js';

// MOCK: 10,000 buys on one documentary day; 5,000 sells the next day.
// Buys cost100100; sold basis50050; proceeds59900; realized9850; remaining50050.
const start = performance.now();
const trades: DocumentOrderTrade[] = Array.from({ length: 15_000 }, (_, index) => {
  const buy = index < 10_000;
  return {
    id: `MOCK-order-${index}`,
    accountId: 'MOCK-order-account',
    securityId: 'MOCK-security',
    broker: 'DIME',
    market: 'US',
    currency: 'USD',
    feeCurrency: 'USD',
    status: 'CONFIRMED',
    precision: 'DOCUMENT_DATE',
    executedAt: null,
    sequence: null,
    executionPrice: null,
    tradeDate: buy ? '2026-01-05' : '2026-01-06',
    side: buy ? 'BUY' : 'SELL',
    quantity: '1',
    unitPrice: buy ? '10' : '12',
    grossAmount: buy ? '10' : '12',
    fee: buy ? '0.01' : '0.02',
    tax: '0',
    netAmount: buy ? '10.01' : '11.98',
    externalRef: `MOCK-order-ref-${index}`,
    importBatchId: `MOCK-doc-${Math.floor(index / 100)}`,
    sourceRow: (index % 100) + 1,
  };
});
const replayStart = performance.now();
const position = rebuildPositions([...trades].reverse())[0];
assert.ok(position);
assert.equal(position.calculationStatus, 'AVAILABLE');
assert.equal(position.quantity, '5000');
assert.equal(position.costBasis, '50050');
assert.equal(position.realizedPL, '9850');
const replayMs = Math.round(performance.now() - replayStart);
const dedupStart = performance.now();
const duplicate = mergeLedger(trades, trades);
assert.equal(duplicate.duplicates, 15_000);
assert.equal(duplicate.added.length, 0);
console.log(
  JSON.stringify({
    dataMode: 'MOCK',
    kind: 'DOCUMENT_DATE',
    count: 15000,
    replayMs,
    dedupMs: Math.round(performance.now() - dedupStart),
    totalMs: Math.round(performance.now() - start),
    quantity: position.quantity,
    costBasis: position.costBasis,
    realizedPL: position.realizedPL,
  }),
);
