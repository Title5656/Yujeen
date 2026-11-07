import { describe, expect, it } from 'vitest';
import { rebuildPositions } from './positions.js';
import type { Trade } from './trade.js';

// Synthetic confirmed trades; expected amounts below are hand-derived.
function trade(id: string, patch: Partial<Trade> = {}): Trade {
  return {
    id,
    accountId: 'mock-account',
    securityId: 'mock-us-a',
    broker: 'DIME',
    market: 'US',
    currency: 'USD',
    status: 'FILLED',
    side: 'BUY',
    executedAt: '2026-01-05T15:00:00.000Z',
    sequence: 0,
    tradeDate: '2026-01-05',
    quantity: '1',
    executionPrice: '10',
    fee: '0',
    tax: '0',
    feeCurrency: 'USD',
    externalRef: id,
    importBatchId: 'mock-import',
    sourceRow: Number(id.replace(/\D/g, '')) || 1,
    ...patch,
  };
}

describe('DIME US compressed FIFO — provisional intraday policy', () => {
  it('reproduces the published daily weighted-lot example without rounding the unit cost to cents', () => {
    // Day 1: 100*10 + 50*12 = 1600 / 150 shares. Day 2: 30*15 = 450.
    // Sell 120 on day 3: allocated1600*120/150=1280; remaining320+450=770.
    const result = rebuildPositions([
      trade('t4', {
        side: 'SELL',
        quantity: '120',
        executionPrice: '20',
        executedAt: '2026-01-07T15:00:00Z',
        tradeDate: '2026-01-07',
      }),
      trade('t2', { quantity: '50', executionPrice: '12', sequence: 1 }),
      trade('t1', { quantity: '100' }),
      trade('t3', {
        quantity: '30',
        executionPrice: '15',
        executedAt: '2026-01-06T15:00:00Z',
        tradeDate: '2026-01-06',
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      quantity: '60',
      costBasis: '770',
      realizedPL: '1120',
      averageCost: '12.833333333333333333333333',
    });
    expect(result[0]?.lots).toEqual([
      { tradeDate: '2026-01-05', quantity: '30', costBasis: '320' },
      { tradeDate: '2026-01-06', quantity: '30', costBasis: '450' },
    ]);
    expect(result[0]?.sales[0]).toMatchObject({
      allocatedCostBasis: '1280',
      netProceeds: '2400',
      realizedPL: '1120',
    });
  });

  it('includes purchase fee/tax in basis and subtracts sale fee/tax from proceeds across lots', () => {
    // 2*10+1+.2=21.2; 1*20+.4=20.4. Sell2.5@30:75-.5-.1=74.4.
    // Basis21.2+10.2=31.4; realized43; remainder .5 shares costing10.2.
    const [position] = rebuildPositions([
      trade('t1', { quantity: '2', fee: '1', tax: '0.2' }),
      trade('t2', {
        executionPrice: '20',
        fee: '0.4',
        executedAt: '2026-01-06T15:00:00Z',
        tradeDate: '2026-01-06',
      }),
      trade('t3', {
        side: 'SELL',
        quantity: '2.5',
        executionPrice: '30',
        fee: '0.5',
        tax: '0.1',
        executedAt: '2026-01-07T15:00:00Z',
        tradeDate: '2026-01-07',
      }),
    ]);
    expect(position).toMatchObject({
      quantity: '0.5',
      costBasis: '10.2',
      averageCost: '20.4',
      realizedPL: '43',
    });
    expect(position?.sales[0]).toMatchObject({
      grossProceeds: '75',
      netProceeds: '74.4',
      allocatedCostBasis: '31.4',
      realizedPL: '43',
    });
    expect(position?.sales[0]?.allocations).toEqual([
      { tradeDate: '2026-01-05', quantity: '2', costBasis: '21.2' },
      { tradeDate: '2026-01-06', quantity: '0.5', costBasis: '10.2' },
    ]);
  });

  it('retains twelve-place fractional quantities and exact purchase products', () => {
    const [position] = rebuildPositions([
      trade('t1', { quantity: '0.123456789012', executionPrice: '123.45', fee: '0.000000000001' }),
      trade('t2', {
        side: 'SELL',
        quantity: '0.000000000012',
        executionPrice: '123.45',
        executedAt: '2026-01-06T15:00:00Z',
        tradeDate: '2026-01-06',
      }),
    ]);
    expect(position?.quantity).toBe('0.123456789');
    expect(position?.costBasis).toBe('15.240740602050999999999903');
    expect(position?.sales[0]?.allocatedCostBasis).toBe('0.000000001481400000000097');
    expect(position?.realizedPL).toBe('-0.000000000000000000000097');
  });

  it('consumes final rounding residual on liquidation and rebuilds the same literal position', () => {
    // Buy3@1 plus fee1 => basis4; each of first two sales allocates 4/3 rounded24.
    const ledger = [
      trade('t1', { quantity: '3', executionPrice: '1', fee: '1' }),
      ...[2, 3, 4].map((n) =>
        trade(`t${n}`, {
          side: 'SELL',
          executionPrice: '2',
          sequence: n,
          executedAt: '2026-01-06T15:00:00Z',
          tradeDate: '2026-01-06',
        }),
      ),
    ];
    const expected = {
      quantity: '0',
      costBasis: '0',
      averageCost: null,
      realizedPL: '2',
      lots: [],
    };
    expect(rebuildPositions(ledger)[0]).toMatchObject(expected);
    expect(rebuildPositions([...ledger].reverse())[0]).toMatchObject(expected);
    expect(rebuildPositions(ledger)[0]?.sales.map((sale) => sale.allocatedCostBasis)).toEqual([
      '1.333333333333333333333333',
      '1.333333333333333333333334',
      '1.333333333333333333333333',
    ]);
  });

  it('rounds half ties to even at 24 places while conserving the remaining basis', () => {
    const [position] = rebuildPositions([
      trade('t1', { quantity: '2', executionPrice: '0.000000000001', fee: '0.000000000001' }),
      trade('t2', {
        side: 'SELL',
        quantity: '0.000000000001',
        executionPrice: '1',
        executedAt: '2026-01-06T15:00:00Z',
        tradeDate: '2026-01-06',
      }),
    ]);
    // Basis 3e-12 * (1e-12 / 2) = 1.5e-24 -> 2e-24.
    expect(position?.sales[0]?.allocatedCostBasis).toBe('0.000000000000000000000002');
    expect(position?.costBasis).toBe('0.000000000002999999999998');
  });

  it('uses only buys already executed before a same-day sale, then merges a later buy into the remainder', () => {
    const [position] = rebuildPositions([
      trade('t1', { quantity: '2' }),
      trade('t2', { side: 'SELL', executionPrice: '15', sequence: 1 }),
      trade('t3', { executionPrice: '30', sequence: 2 }),
    ]);
    expect(position).toMatchObject({
      quantity: '2',
      costBasis: '40',
      realizedPL: '5',
      averageCost: '20',
    });
    expect(position?.lots).toEqual([{ tradeDate: '2026-01-05', quantity: '2', costBasis: '40' }]);
  });

  it('starts a fresh lot after selling out and rebuying on the same day', () => {
    const [position] = rebuildPositions([
      trade('t1'),
      trade('t2', { side: 'SELL', executionPrice: '15', sequence: 1 }),
      trade('t3', { executionPrice: '30', sequence: 2 }),
    ]);
    expect(position).toMatchObject({ quantity: '1', costBasis: '30', realizedPL: '5' });
  });

  it('does not allow later purchases to cover an earlier oversell', () => {
    expect(() =>
      rebuildPositions([trade('t1', { side: 'SELL' }), trade('t2', { sequence: 1 })]),
    ).toThrow(/oversell/i);
  });

  it('rejects overselling instead of returning a negative position', () => {
    expect(() =>
      rebuildPositions([
        trade('t1'),
        trade('t2', { side: 'SELL', quantity: '1.000000000001', sequence: 1 }),
      ]),
    ).toThrow(/oversell/i);
  });

  it('does not pool accounts or distinct securities', () => {
    const result = rebuildPositions([
      trade('t1'),
      trade('t2', { accountId: 'other' }),
      trade('t3', { securityId: 'different-security' }),
    ]);
    expect(result.map((p) => [p.accountId, p.securityId, p.quantity, p.costBasis])).toEqual([
      ['mock-account', 'different-security', '1', '10'],
      ['mock-account', 'mock-us-a', '1', '10'],
      ['other', 'mock-us-a', '1', '10'],
    ]);
  });

  it('rejects ambiguous execution ordering and repeated ledger entries', () => {
    expect(() => rebuildPositions([trade('t1'), trade('t2', { side: 'SELL' })])).toThrow(
      /order|sequence|ambiguous/i,
    );
    expect(() => rebuildPositions([trade('t1'), trade('t1')])).toThrow();
  });

  it('validates filled trades at the pure domain boundary without mutating the caller', () => {
    const input = Object.freeze(trade('t1'));
    expect(rebuildPositions([input])[0]).toMatchObject({
      quantity: '1',
      costBasis: '10',
      realizedPL: '0',
    });
    expect(input.quantity).toBe('1');
    expect(() => rebuildPositions([trade('t2', { status: 'PENDING' as 'FILLED' })])).toThrow();
    expect(() => rebuildPositions([trade('t3', { market: 'TH' as 'US' })])).toThrow();
  });
  it('returns no positions for an empty ledger', () => {
    expect(rebuildPositions([])).toEqual([]);
  });
});
