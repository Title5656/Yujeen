import { FxRateSchema, MarketQuoteSchema } from '@portfolio/contracts';
import type { AlpacaCredentials, FxRate, MarketQuote } from '@portfolio/contracts';
import { MarketDataError } from './provider.js';
import type { ConnectionHealth, MarketDataProvider, QuoteRequest } from './provider.js';

type Transport = (url: string, init?: RequestInit) => Promise<Response>;

export const providers = {
  alpaca: { label: 'Alpaca', feed: 'IEX' },
  frankfurter: { label: 'Frankfurter', feed: 'REFERENCE' },
  mock: { label: 'MOCK', feed: 'SYNTHETIC' },
} as const;

async function requestJson(
  url: string,
  fetchUpstream: Transport,
  now: () => number,
  headers?: Record<string, string>,
) {
  try {
    const response = await fetchUpstream(url, {
      ...(headers ? { headers } : {}),
      // Workers support manual redirects. Reject non-2xx below so credentials stay on the original host.
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new MarketDataError('AUTH_FAILED', 'Provider refused credentials or feed');
    }
    if (response.status === 429) {
      const raw = response.headers.get('Retry-After');
      const retryAfter =
        raw && /^\d{1,10}$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) : NaN;
      throw new MarketDataError(
        'RATE_LIMITED',
        'Provider rate limit',
        Number.isFinite(retryAfter)
          ? raw && /^\d+$/.test(raw)
            ? now() + retryAfter
            : retryAfter
          : undefined,
      );
    }
    if (!response.ok) throw new MarketDataError('PROVIDER_ERROR', 'Provider unavailable');
    // These endpoints return one pair or a small batch. Bound upstream response size.
    const reader = response.body?.getReader();
    if (!reader) throw new MarketDataError('PROVIDER_ERROR', 'Missing provider response');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let body = '';
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64 * 1024) {
          await reader.cancel();
          throw new MarketDataError('PROVIDER_ERROR', 'Provider response too large');
        }
        body += decoder.decode(value, { stream: true });
      }
      return JSON.parse(body + decoder.decode()) as unknown;
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError('NETWORK', 'Invalid or unavailable provider response');
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function decimal(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  const raw = String(value);
  const tiny = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(raw);
  return tiny && Number(tiny[3]) <= 12
    ? '0.' + '0'.repeat(Number(tiny[3]) - 1) + tiny[1] + (tiny[2] ?? '')
    : raw;
}

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

export async function fetchReferenceFx(fetchUpstream: Transport, now: number): Promise<FxRate> {
  const record = object(
    await requestJson('https://api.frankfurter.dev/v2/rate/usd/thb', fetchUpstream, () => now),
  );
  const fetchedAt = new Date(now).toISOString();
  const fx = FxRateSchema.safeParse({
    base: record?.base,
    quote: record?.quote,
    rate: decimal(record?.rate),
    date: record?.date,
    fetchedAt,
    source: 'frankfurter-blended',
    dataMode: 'LIVE',
  });
  if (!fx.success || fx.data.date > fetchedAt.slice(0, 10)) {
    throw new MarketDataError('PROVIDER_ERROR', 'Invalid reference rate');
  }
  return fx.data;
}
