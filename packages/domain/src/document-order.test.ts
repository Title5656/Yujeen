import { describe, expect, it } from 'vitest';
import { rebuildPositions } from './positions.js';
import { mergeLedger, LedgerConflictError } from './ledger.js';
import {
  tradeFingerprint,
  validateTrade,
  type DocumentOrderTrade,
  type ExecutionTrade,
} from './trade.js';
import { valuePosition } from './valuation.js';

// Entirely synthetic documentary order summaries: price is rounded; gross is reported.
function order(id: string, patch: Partial<DocumentOrderTrade> = {}): DocumentOrderTrade {
  return {
    id,
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
    quantity: '3',
    unitPrice: '3.3333',
    grossAmount: '10',
    fee: '0.2',
    tax: '0.1',
    netAmount: '10.3',
    feeCurrency: 'USD',
    externalRef: `mock-order:${id}`,
    importBatchId: 'mock-batch',
    sourceRow: Number(id.replace(/\D/g, '')) || 1,
    ...patch,
  };
}
function fill(id: string, patch: Partial<ExecutionTrade> = {}): ExecutionTrade {
  return {
    id,
    accountId: 'mock-account',
    securityId: 'mock-us-a',
    broker: 'DIME',
    market: 'US',
    currency: 'USD',
    status: 'FILLED',
    side: 'BUY',
    executedAt: '2026-01-05T15:00:00Z',
    sequence: 0,
    tradeDate: '2026-01-05',
    quantity: '1',
    executionPrice: '20',
    fee: '0',
    tax: '0',
    feeCurrency: 'USD',
    externalRef: id,
    importBatchId: 'mock-fill-batch',
    sourceRow: Number(id.replace(/\D/g, '')) || 1,
    ...patch,
  };
}

describe('documentary date orders', () => {
  it('does not let a future documentary buy excuse an earlier invalid execution oversell', () => {
    expect(() =>
      rebuildPositions([fill('f1', { side: 'SELL' }), order('o1', { tradeDate: '2026-01-06' })]),
    ).toThrow(/oversell/i);
  });

  it('rejects an execution oversell after documentary buys with known inventory', () => {
    expect(() =>
      rebuildPositions([
        order('o1'),
        fill('f1', {
          side: 'SELL',
          quantity: '4',
          tradeDate: '2026-01-06',
          executedAt: '2026-01-06T15:00:00Z',
        }),
      ]),
    ).toThrow(/oversell/i);
  });

  it('validates reported economics without deriving gross from rounded unit price or inventing time', () => {
    const normalized = validateTrade(order('o1', { unitPrice: '3.333300', grossAmount: '10.00' }));
    expect(normalized).toMatchObject({
      precision: 'DOCUMENT_DATE',
      status: 'CONFIRMED',
      executedAt: null,
      executionPrice: null,
      sequence: null,
      unitPrice: '3.3333',
      grossAmount: '10',
      netAmount: '10.3',
    });
    expect(rebuildPositions([normalized])[0]).toMatchObject({
      quantity: '3',
      costBasis: '10.3',
      realizedPL: '0',
      calculationStatus: 'AVAILABLE',
    });
  });

  it.each([
    { netAmount: '10.300000000001' },
    { grossAmount: '9.99' },
    { externalRef: null },
    { tradeDate: '2026-02-29' },
    { tradeDate: '2026-04-31' },
    { tradeDate: '0000-01-01' },
    { executedAt: '2026-01-05T15:00:00Z' },
    { sequence: 0 },
    { executionPrice: '3.3333' },
    { unitPrice: '0' },
    { fee: undefined },
    { status: 'FILLED' },
  ])('rejects inconsistent or invented documentary fields %j', (patch) => {
    expect(() => validateTrade({ ...order('o1'), ...patch } as DocumentOrderTrade)).toThrow();
  });

  it('uses v2 order identity and keeps separate orders with identical economics', () => {
    const first = order('o1');
    const copy = order('o2', { externalRef: first.externalRef, importBatchId: 'mock-copy' });
    expect(tradeFingerprint(first)).toBe(
      'trade:v2:["DOCUMENT_DATE","DIME","US","mock-account","mock-us-a","BUY","2026-01-05","mock-order:o1","3","3.3333","10","10.3","0.2","0.1","USD","USD"]',
    );
    expect(mergeLedger([first], [copy])).toMatchObject({ added: [], duplicates: 1 });
    expect(mergeLedger([first], [order('o2')]).added).toHaveLength(1);
    expect(() =>
      mergeLedger(
        [first],
        [order('o2', { externalRef: first.externalRef, grossAmount: '11', netAmount: '11.3' })],
      ),
    ).toThrow(LedgerConflictError);
  });

  it('compresses known daily buys then uses reported net sell proceeds against earlier daily lots', () => {
    const [position] = rebuildPositions([
      order('o1'),
      order('o2', { quantity: '2', unitPrice: '10', grossAmount: '20', netAmount: '20.3' }),
      order('o3', {
        tradeDate: '2026-01-06',
        quantity: '1',
        unitPrice: '15',
        grossAmount: '15',
        netAmount: '15.3',
      }),
      order('o4', {
        side: 'SELL',
        tradeDate: '2026-01-07',
        quantity: '4',
        unitPrice: '12.5',
        grossAmount: '50',
        netAmount: '49.7',
      }),
    ]);
    // Day one basis30.6 /5; sale4 consumes24.48; leaves6.12+15.3=21.42. Realized49.7-24.48=25.22.
    expect(position).toMatchObject({
      quantity: '2',
      costBasis: '21.42',
      realizedPL: '25.22',
      calculationStatus: 'AVAILABLE',
    });
    expect(position?.sales[0]).toMatchObject({
      grossProceeds: '50',
      netProceeds: '49.7',
      allocatedCostBasis: '24.48',
      realizedPL: '25.22',
    });
  });

  it('rejects sell cash-flow mismatches exactly without a cents tolerance', () => {
    expect(() => validateTrade(order('o1', { side: 'SELL', netAmount: '10.3' }))).toThrow(
      /net|cash|amount/i,
    );
    expect(validateTrade(order('o1', { side: 'SELL', netAmount: '9.7' }))).toMatchObject({
      netAmount: '9.7',
    });
  });

  it('keeps same-day buy and sell entries but makes cost unavailable without inventing their order', () => {
    const ledger = [order('o1'), order('o2', { side: 'SELL', quantity: '1', netAmount: '9.7' })];
    const [position] = rebuildPositions(ledger);
    expect(position).toMatchObject({
      quantity: '2',
      costBasis: null,
      averageCost: null,
      realizedPL: null,
      calculationStatus: 'AMBIGUOUS_DOCUMENT_ORDER',
      lots: [],
    });
    expect(rebuildPositions([...ledger].reverse())).toEqual(rebuildPositions(ledger));
  });

  it.each(['BUY', 'SELL'] as const)(
    'detects mixed date/fill same-day ambiguity (%s fill)',
    (side) => {
      const [position] = rebuildPositions([
        order('o1', {
          side: side === 'BUY' ? 'SELL' : 'BUY',
          netAmount: side === 'BUY' ? '9.7' : '10.3',
        }),
        fill('f1', { side }),
      ]);
      expect(position).toMatchObject({
        costBasis: null,
        realizedPL: null,
        calculationStatus: 'AMBIGUOUS_DOCUMENT_ORDER',
      });
    },
  );

  it('mixes fills and documentary buys on separate days with known FIFO cost', () => {
    const [position] = rebuildPositions([
      fill('f1'),
      order('o1', { tradeDate: '2026-01-06' }),
      order('o2', { side: 'SELL', tradeDate: '2026-01-07', quantity: '2', netAmount: '9.7' }),
    ]);
    // Earlier fill20 + 1/3 of documentary10.3 -> cost23.433333..., remaining6.866666...
    expect(position).toMatchObject({
      quantity: '2',
      costBasis: '6.866666666666666666666667',
      realizedPL: '-13.733333333333333333333333',
      calculationStatus: 'AVAILABLE',
    });
  });

  it('keeps incomplete documentary history with an unavailable cost while legacy oversell still rejects', () => {
    const [position] = rebuildPositions([
      order('o1', { side: 'SELL', netAmount: '9.7' }),
      order('o2', { tradeDate: '2026-01-06', quantity: '5' }),
    ]);
    expect(position).toMatchObject({
      quantity: '2',
      costBasis: null,
      realizedPL: null,
      calculationStatus: 'INCOMPLETE_HISTORY',
    });
    expect(() => rebuildPositions([fill('f1', { side: 'SELL' })])).toThrow(/oversell/i);
  });

  it('values known quantity with unavailable cost and retains null profit through reference FX', () => {
    const [position] = rebuildPositions([
      order('o1'),
      order('o2', { side: 'SELL', quantity: '1', netAmount: '9.7' }),
    ]);
    expect(position).toBeDefined();
    const result = valuePosition(
      position!,
      {
        securityId: 'mock-us-a',
        currency: 'USD',
        price: '12',
        source: 'mock',
        asOf: '2026-01-08T15:00:00Z',
        quality: 'EOD',
        dataMode: 'MOCK',
      },
      {
        valuedAt: '2026-01-08T15:01:00Z',
        quoteMaxAgeMs: 120000,
        fxMaxAgeMs: 120000,
        fx: {
          base: 'USD',
          quote: 'THB',
          rate: '35',
          source: 'mock',
          asOf: '2026-01-08T15:00:00Z',
          dataMode: 'MOCK',
        },
      },
    );
    expect(result).toMatchObject({
      marketValue: '24',
      unrealizedPL: null,
      realizedPL: null,
      referenceTHB: { marketValue: '840', unrealizedPL: null },
    });
  });

  it('retains a negative diagnostic ledger balance without valuing it as a short holding', () => {
    const [position] = rebuildPositions([order('o1', { side: 'SELL', netAmount: '9.7' })]);
    expect(position).toMatchObject({
      quantity: '-3',
      costBasis: null,
      calculationStatus: 'INCOMPLETE_HISTORY',
    });
    expect(
      valuePosition(
        position!,
        {
          securityId: 'mock-us-a',
          currency: 'USD',
          price: '12',
          source: 'mock',
          asOf: '2026-01-08T15:00:00Z',
          quality: 'EOD',
          dataMode: 'MOCK',
        },
        { valuedAt: '2026-01-08T15:01:00Z', quoteMaxAgeMs: 120000, fxMaxAgeMs: 120000 },
      ),
    ).toMatchObject({
      marketValue: null,
      unrealizedPL: null,
      realizedPL: null,
      calculationStatus: 'INCOMPLETE_HISTORY',
    });
  });

  it('does not value a negative net balance from an ambiguous documentary day as a short', () => {
    const [position] = rebuildPositions([
      order('o1', { quantity: '1' }),
      order('o2', { side: 'SELL', quantity: '3', netAmount: '9.7' }),
    ]);
    expect(position).toMatchObject({
      quantity: '-2',
      calculationStatus: 'AMBIGUOUS_DOCUMENT_ORDER',
    });
    expect(
      valuePosition(
        position!,
        {
          securityId: 'mock-us-a',
          currency: 'USD',
          price: '12',
          source: 'mock',
          asOf: '2026-01-08T15:00:00Z',
          quality: 'EOD',
          dataMode: 'MOCK',
        },
        { valuedAt: '2026-01-08T15:01:00Z', quoteMaxAgeMs: 120000, fxMaxAgeMs: 120000 },
      ),
    ).toMatchObject({ marketValue: null });
  });

  it('keeps aggregate FIFO sales known without assigning an invented order to two documentary sells', () => {
    const [position] = rebuildPositions([
      order('o1', { quantity: '2', grossAmount: '8', netAmount: '8.3' }),
      order('o2', { tradeDate: '2026-01-06', quantity: '2', grossAmount: '12', netAmount: '12.3' }),
      order('o3', {
        side: 'SELL',
        tradeDate: '2026-01-07',
        quantity: '1',
        grossAmount: '7',
        netAmount: '6.7',
      }),
      order('o4', {
        side: 'SELL',
        tradeDate: '2026-01-07',
        quantity: '2',
        grossAmount: '14',
        netAmount: '13.7',
      }),
    ]);
    // Three sold consume first day's8.3 + half second day's12.3 =14.45; proceeds20.4.
    expect(position).toMatchObject({
      quantity: '1',
      costBasis: '6.15',
      realizedPL: '5.95',
      calculationStatus: 'AVAILABLE',
    });
    expect(position?.sales.map((sale) => [sale.allocatedCostBasis, sale.realizedPL])).toEqual([
      [null, null],
      [null, null],
    ]);
  });
});
