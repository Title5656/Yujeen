import { describe, expect, it } from 'vitest';
import { valuePosition } from './valuation.js';
import type { Position } from './positions.js';
import type { PriceQuote, ReferenceFx } from './valuation.js';

const position: Position = {
  accountId: 'mock-account',
  securityId: 'mock-a',
  currency: 'USD',
  quantity: '1',
  costBasis: '101',
  averageCost: '101',
  realizedPL: '5',
  lots: [],
  sales: [],
};
const quote: PriceQuote = {
  securityId: 'mock-a',
  currency: 'USD',
  price: '110',
  source: 'mock',
  asOf: '2026-01-06T15:00:00Z',
  quality: 'UNKNOWN',
  dataMode: 'MOCK',
};
const context = { valuedAt: '2026-01-06T15:01:00Z', maxAgeMs: 120_000 };
const fx: ReferenceFx = {
  base: 'USD',
  quote: 'THB',
  rate: '35.5',
  source: 'mock-fx',
  asOf: '2026-01-06T15:00:00Z',
  dataMode: 'MOCK',
};

describe('valuation and historical FX policy', () => {
  it.each([
    ['110', '110', '9'],
    ['90', '90', '-11'],
  ])(
    'values a share at %s including its capitalized purchase fee',
    (price, marketValue, unrealizedPL) => {
      expect(valuePosition(position, { ...quote, price }, context)).toMatchObject({
        marketValue,
        unrealizedPL,
        realizedPL: '5',
        quoteStatus: 'UNKNOWN',
      });
    },
  );

  it('preserves exact fractional valuation and quote provenance with the MOCK label', () => {
    const result = valuePosition(
      { ...position, quantity: '0.1', costBasis: '0.01' },
      { ...quote, price: '0.2' },
      context,
    );
    expect(result).toMatchObject({
      marketValue: '0.02',
      unrealizedPL: '0.01',
      quote: {
        price: '0.2',
        source: 'mock',
        asOf: '2026-01-06T15:00:00.000Z',
        dataMode: 'MOCK',
        quality: 'UNKNOWN',
      },
    });
  });

  it('returns unavailable for a missing quote rather than inventing a zero price or daily P/L', () => {
    expect(valuePosition(position, null, context)).toMatchObject({
      marketValue: null,
      unrealizedPL: null,
      quoteStatus: 'MISSING',
      dailyPL: null,
      referenceTHB: null,
      referenceFxStatus: 'MISSING',
    });
  });

  it('marks old prices stale while keeping their source and timestamp', () => {
    const result = valuePosition(position, quote, {
      ...context,
      valuedAt: '2026-01-06T15:02:00.001Z',
    });
    expect(result).toMatchObject({
      quoteStatus: 'STALE',
      marketValue: '110',
      quote: { source: 'mock', asOf: '2026-01-06T15:00:00.000Z' },
    });
  });

  it('retains provider quality even when a recent quote passes the age threshold', () => {
    expect(valuePosition(position, { ...quote, quality: 'DELAYED' }, context)).toMatchObject({
      quoteStatus: 'AVAILABLE',
      quote: { quality: 'DELAYED' },
    });
  });

  it('labels current FX conversions as reference and leaves historical THB realized P/L unavailable', () => {
    // 110*35.5=3905; unrealized9*35.5=319.5. Current FX cannot convert historical5.
    expect(valuePosition(position, quote, { ...context, fx })).toMatchObject({
      referenceTHB: {
        marketValue: '3905',
        unrealizedPL: '319.5',
        source: 'mock-fx',
        asOf: '2026-01-06T15:00:00.000Z',
        dataMode: 'MOCK',
        purpose: 'REFERENCE_ONLY',
      },
      referenceFxStatus: 'AVAILABLE',
      historicalRealizedPLTHB: null,
      historicalFxStatus: 'UNAVAILABLE',
    });
  });

  it('reports missing and stale FX separately from security-price freshness', () => {
    expect(valuePosition(position, quote, context)).toMatchObject({
      referenceTHB: null,
      referenceFxStatus: 'MISSING',
    });
    expect(
      valuePosition(position, quote, { ...context, fx: { ...fx, asOf: '2026-01-05T15:00:00Z' } }),
    ).toMatchObject({ quoteStatus: 'UNKNOWN', referenceFxStatus: 'STALE' });
  });

  it.each([
    { ...quote, securityId: 'other' },
    { ...quote, currency: 'THB' as 'USD' },
    { ...quote, price: '0' },
    { ...quote, price: '-1' },
    { ...quote, asOf: '2026-02-30T12:00:00Z' },
    { ...quote, asOf: '2026-01-06T16:00:00Z' },
    { ...quote, source: '' },
    { ...quote, quality: 'FRESH' as 'REALTIME' },
    { ...quote, dataMode: 'UNKNOWN' as 'MOCK' },
  ])('rejects mismatched or malformed valuation quote %#', (bad) => {
    expect(() => valuePosition(position, bad, context)).toThrow();
  });

  it.each([
    { ...fx, base: 'THB' as 'USD' },
    { ...fx, rate: '0' },
    { ...fx, rate: '1e2' },
    { ...fx, asOf: '2026-01-07T15:00:00Z' },
  ])('rejects an invalid or future FX reference %#', (bad) => {
    expect(() => valuePosition(position, quote, { ...context, fx: bad })).toThrow();
  });

  it('rejects invalid valuation clock/precision settings', () => {
    expect(() => valuePosition(position, quote, { ...context, maxAgeMs: -1 })).toThrow();
    expect(() => valuePosition(position, quote, { ...context, valuedAt: 'yesterday' })).toThrow();
  });
});
