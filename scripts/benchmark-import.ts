import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  buildImportPreview,
  SyntheticDimeParser,
  documentSha256,
} from '../packages/importers/dist/index.js';
import {
  mergeLedger,
  rebuildPositions,
  type LedgerSnapshot,
  type Trade,
} from '../packages/domain/dist/index.js';

const context = {
  accountId: 'MOCK-benchmark',
  securities: [{ symbol: 'MOCK', market: 'US', currency: 'USD', securityId: 'MOCK-security' }],
};
const empty: LedgerSnapshot = { revision: 0, trades: [], batches: [], aliases: [] };
const parser = new SyntheticDimeParser();
const results: Record<string, number | string>[] = [];

// Every 5 fills: buy 4x1 @10 + .01 fee each, sell 2 @12 - .02 fee.
// Per cycle: quantity2, basis20.02, realized3.96. Literal expected values below.
for (const sample of [
  { count: 1_000, quantity: '400', basis: '4004', realized: '792' },
  { count: 10_000, quantity: '4000', basis: '40040', realized: '7920' },
  { count: 50_000, quantity: '20000', basis: '200200', realized: '39600' },
]) {
  const start = performance.now();
  const trades: Trade[] = [];
  let lastParsed: ReturnType<SyntheticDimeParser['parse']> | undefined;
  for (let base = 0; base < sample.count; base += 100) {
    const lines = [
      'YUJEEN_SYNTHETIC_DIME_V1',
      ...Array.from({ length: 100 }, (_, j) => {
        const index = base + j;
        const sale = index % 5 === 4;
        return JSON.stringify({
          symbol: 'MOCK',
          market: 'US',
          currency: 'USD',
          feeCurrency: 'USD',
          side: sale ? 'SELL' : 'BUY',
          tradeStatus: 'FILLED',
          executedAt: '2026-01-05T15:00:00Z',
          sequence: String(index + 1),
          quantity: sale ? '2' : '1',
          executionPrice: sale ? '12' : '10',
          fee: sale ? '0.02' : '0.01',
          tax: '0',
          externalRef: `MOCK-fill-${index}`,
          referenceKind: 'FILL',
        });
      }),
    ];
    const hash = await documentSha256(new TextEncoder().encode(lines.join('\n')));
    lastParsed = parser.parse({
      documentSha256: hash,
      method: 'PDF_TEXT',
      issues: [],
      pages: [{ page: 1, lines: lines.map((text, i) => ({ text, line: i + 1, confidence: 1 })) }],
    });
    const preview = await buildImportPreview(lastParsed, context, empty);
    assert.equal(preview.canConfirm, true);
    for (const row of preview.rows) {
      assert.ok(row.trade);
      trades.push(row.trade);
    }
  }
  const parsePreviewMs = performance.now() - start;
  const dedupStart = performance.now();
  const duplicate = mergeLedger(trades, trades);
  assert.equal(duplicate.added.length, 0);
  assert.equal(duplicate.duplicates, sample.count);
  const dedupMs = performance.now() - dedupStart;
  const replayStart = performance.now();
  const position = rebuildPositions([...trades].reverse())[0];
  assert.ok(position);
  assert.equal(position.quantity, sample.quantity);
  assert.equal(position.costBasis, sample.basis);
  assert.equal(position.realizedPL, sample.realized);
  const replayMs = performance.now() - replayStart;
  const largePreviewStart = performance.now();
  const repeated = await buildImportPreview(lastParsed, context, { ...empty, revision: 1, trades });
  assert.equal(repeated.status, 'DUPLICATE');
  assert.equal(repeated.rows.length, 100);
  const previewAgainstLedgerMs = performance.now() - largePreviewStart;
  results.push({
    dataMode: 'MOCK',
    trades: sample.count,
    documents: sample.count / 100,
    parsePreviewMs: Math.round(parsePreviewMs),
    dedupMs: Math.round(dedupMs),
    replayMs: Math.round(replayMs),
    previewAgainstLedgerMs: Math.round(previewAgainstLedgerMs),
    quantity: position.quantity,
    costBasis: position.costBasis,
    realizedPL: position.realizedPL,
  });
  console.log(JSON.stringify(results.at(-1)));
}
console.log(
  JSON.stringify(
    { node: process.version, platform: process.platform, optimization: 'NONE', results },
    null,
    2,
  ),
);
