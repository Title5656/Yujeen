import { describe, expect, it } from 'vitest';
import { MarketQuoteSchema } from '@portfolio/contracts';
import { MarketDataError, MockProvider } from './index.js';

const usRequest = { securityId: 'mock-us-aapl', symbol: 'AAPL', market: 'US' as const };

describe('MockProvider contract', () => {
  it('returns identical validated synthetic quotes on every invocation', async () => {
    const provider = new MockProvider();
    const first = await provider.getQuotes([usRequest]);
    expect(first).toEqual(await provider.getQuotes([usRequest]));
    expect(first).toHaveLength(1);
    expect(MarketQuoteSchema.parse(first[0])).toMatchObject({
      price: '123.45',
      dataMode: 'MOCK',
      source: 'mock',
      feed: 'SYNTHETIC',
      asOf: '2026-01-02T15:30:00.000Z',
      fetchedAt: '2026-01-02T15:30:00.000Z',
    });
  });

  it('distinguishes the same symbol on different markets and preserves order', async () => {
    const quotes = await new MockProvider().getQuotes([
      { securityId: 'mock-th-aapl', symbol: 'AAPL', market: 'TH' },
      usRequest,
    ]);
    expect(quotes.map(({ currency, price }) => [currency, price])).toEqual([
      ['THB', '234.56'],
      ['USD', '123.45'],
    ]);
  });

  it.each([
    { ...usRequest, symbol: 'UNKNOWN' },
    { ...usRequest, securityId: 'different-security' },
    { ...usRequest, market: 'TH' as const },
  ])('rejects unsupported securities instead of inventing a quote', async (request) => {
    await expect(new MockProvider().getQuotes([request])).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  it('returns no quotes for an empty batch', async () => {
    expect(await new MockProvider().getQuotes([])).toEqual([]);
  });

  it('does not expose mutable shared fixture objects', async () => {
    const provider = new MockProvider();
    const [quote] = await provider.getQuotes([usRequest]);
    if (!quote) throw new Error('Expected a fixture');
    Object.assign(quote, { price: '999' });
    expect((await provider.getQuotes([usRequest]))[0]?.price).toBe('123.45');
  });

  it('reports offline mock health without external requests', async () => {
    const provider = new MockProvider();
    expect(provider.id).toBe('mock');
    expect(provider.supportedMarkets()).toEqual(['US', 'TH']);
    expect(await provider.healthCheck()).toEqual({ status: 'ok', dataMode: 'MOCK' });
    expect(new MarketDataError('UNSUPPORTED', 'Unknown security')).toBeInstanceOf(Error);
  });
});
