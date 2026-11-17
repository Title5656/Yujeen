import { MarketQuoteSchema } from '@portfolio/contracts';
import type { AlpacaCredentials, MarketQuote } from '@portfolio/contracts';
import { MarketDataError } from './provider.js';
import type { ConnectionHealth, MarketDataProvider, QuoteRequest } from './provider.js';
import { requestJson, object, decimal } from './http.js';
import type { Transport } from './http.js';

export function quoteRequest(symbol: string): QuoteRequest {
  return { securityId: 'US:' + symbol, market: 'US', symbol };
}

export class AlpacaProvider implements MarketDataProvider {
  readonly id = 'alpaca';
  constructor(
    private readonly credentials: AlpacaCredentials,
    private readonly fetchUpstream: Transport,
    private readonly now: () => number,
  ) {}
  supportedMarkets() {
    return ['US'] as const;
  }
  async healthCheck(): Promise<ConnectionHealth> {
    const quotes = await this.getQuotes([quoteRequest('AAPL')]);
    return { status: quotes.length ? 'ok' : 'unavailable', dataMode: 'LIVE' };
  }
  async getQuotes(requests: readonly QuoteRequest[]): Promise<readonly MarketQuote[]> {
    if (
      !requests.length ||
      requests.length > 20 ||
      requests.some((r) => r.market !== 'US' || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(r.symbol))
    ) {
      throw new MarketDataError('UNSUPPORTED', 'Unsupported US ticker batch');
    }
    const query = new URLSearchParams({
      symbols: requests.map((r) => r.symbol).join(','),
      feed: 'iex',
      currency: 'USD',
    });
    const response = object(
      await requestJson(
        'https://data.alpaca.markets/v2/stocks/trades/latest?' + query,
        this.fetchUpstream,
        this.now,
        {
          'APCA-API-KEY-ID': this.credentials.keyId,
          'APCA-API-SECRET-KEY': this.credentials.secret,
        },
      ),
    );
    const trades = object(response?.trades);
    if (!trades) throw new MarketDataError('PROVIDER_ERROR', 'Invalid trade response');
    const fetchedAt = this.now();
    return requests.flatMap((security) => {
      const trade = object(trades[security.symbol]);
      const tradedAt =
        typeof trade?.t === 'string' &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(trade.t)
          ? Date.parse(trade.t)
          : NaN;
      if (!Number.isFinite(tradedAt) || tradedAt > fetchedAt + 60_000) return [];
      const asOf = new Date(tradedAt).toISOString();
      if (typeof trade?.t !== 'string' || asOf.slice(0, 19) !== trade.t.slice(0, 19)) return [];
      const quote = MarketQuoteSchema.safeParse({
        ...security,
        currency: 'USD',
        price: decimal(trade?.p),
        priceType: 'LAST',
        feed: 'IEX',
        source: 'alpaca',
        asOf,
        fetchedAt: new Date(fetchedAt).toISOString(),
        quality: 'REALTIME',
        dataMode: 'LIVE',
      });
      return quote.success ? [quote.data] : [];
    });
  }
}
