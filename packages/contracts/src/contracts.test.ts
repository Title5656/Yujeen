import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthResponseSchema, MarketQuoteSchema } from './index.js';

describe('boundary validation', () => {
  it('accepts the minimal health response', () => {
    expect(HealthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it.each([{ status: 'unknown' }, { status: 'ok', key: 'secret' }, null])(
    'rejects malformed health responses',
    (input) => {
      expect(HealthResponseSchema.safeParse(input).success).toBe(false);
    },
  );

  it('rejects untyped error codes and unintentional secret fields', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'OOPS', message: 'x' } }).success).toBe(false);
    expect(
      ApiErrorSchema.safeParse({
        error: { code: 'NOT_FOUND', message: 'Missing', stack: 'secret' },
      }).success,
    ).toBe(false);
  });

  const quote = {
    securityId: 'mock-us-aapl',
    symbol: 'AAPL',
    market: 'US',
    currency: 'USD',
    price: '123.45',
    priceType: 'LAST',
    feed: 'SYNTHETIC',
    source: 'mock',
    asOf: '2026-01-02T15:30:00.000Z',
    fetchedAt: '2026-01-02T15:30:00.000Z',
    quality: 'UNKNOWN',
    dataMode: 'MOCK',
  };

  it('retains source, market identity, timestamps and the MOCK label', () => {
    expect(MarketQuoteSchema.parse(quote)).toEqual(quote);
  });

  it.each([
    { price: 123.45 },
    { price: '-1' },
    { price: '0' },
    { asOf: 'yesterday' },
    { source: '' },
    { dataMode: 'LIVE' },
  ])('rejects invalid quote fields %j', (patch) => {
    expect(MarketQuoteSchema.safeParse({ ...quote, ...patch }).success).toBe(false);
  });
});
