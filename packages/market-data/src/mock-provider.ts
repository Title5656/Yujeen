import { MarketQuoteSchema } from '@portfolio/contracts';
import type { MarketQuote } from '@portfolio/contracts';
import { MarketDataError } from './provider.js';
import type { ConnectionHealth, MarketDataProvider, QuoteRequest } from './provider.js';

const timestamp = '2026-01-02T15:30:00.000Z';
const fixtures: readonly MarketQuote[] = [
  { securityId: 'mock-us-aapl', symbol: 'AAPL', market: 'US', currency: 'USD', price: '123.45' },
  { securityId: 'mock-th-aapl', symbol: 'AAPL', market: 'TH', currency: 'THB', price: '234.56' },
].map((fixture) =>
  MarketQuoteSchema.parse({
    ...fixture,
    priceType: 'LAST',
    feed: 'SYNTHETIC',
    source: 'mock',
    asOf: timestamp,
    fetchedAt: timestamp,
    quality: 'UNKNOWN',
    dataMode: 'MOCK',
  }),
);

/** Deliberately fixed offline fixtures; these are not historical or current market prices. */
export class MockProvider implements MarketDataProvider {
  readonly id = 'mock';

  supportedMarkets() {
    return ['US', 'TH'] as const;
  }

  async healthCheck(): Promise<ConnectionHealth> {
    return { status: 'ok', dataMode: 'MOCK' };
  }

  async getQuotes(requests: readonly QuoteRequest[]): Promise<readonly MarketQuote[]> {
    return requests.map((request) => {
      const quote = fixtures.find(
        (fixture) =>
          fixture.securityId === request.securityId &&
          fixture.market === request.market &&
          fixture.symbol === request.symbol,
      );
      if (!quote)
        throw new MarketDataError('UNSUPPORTED', 'No synthetic fixture for this security');
      return MarketQuoteSchema.parse(quote);
    });
  }
}
