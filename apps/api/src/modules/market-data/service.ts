import { FxRateSchema, MarketQuoteSchema } from '@portfolio/contracts';
import type { AlpacaCredentials, MarketData, MarketStatus } from '@portfolio/contracts';
import { createMarketRepository } from '@portfolio/database';
import {
  AlpacaProvider,
  fetchReferenceFx,
  MarketDataError,
  quoteRequest,
} from '@portfolio/market-data';
import type { FetchUpstream, Installation } from '../../middleware/owner.js';
import { sealCredentials, unsealCredentials } from './secrets.js';

const quoteInterval = 15 * 60_000;
const day = 86_400_000;
const fxNamespace = 'frankfurter:v2:usd-thb';
const usdThb = 'USDTHB';
const quoteNamespace = (version: string) => 'alpaca:iex:' + version;
function upstreamFailure(error: unknown, now: number) {
  const code = error instanceof MarketDataError ? error.code : undefined;
  return {
    status: code === 'RATE_LIMITED' || code === 'AUTH_FAILED' ? code : ('UNAVAILABLE' as const),
    retry: {
      rateLimited: code === 'RATE_LIMITED',
      at:
        code === 'RATE_LIMITED' && error instanceof MarketDataError
          ? Math.max(now + 15 * 60_000, error.retryAt ?? 0)
          : now + 60_000,
    },
  };
}

type QuoteAttempt = {
  version: string;
  symbols: readonly string[];
  status: 'NOT_REQUESTED' | 'NO_TRADE' | 'REQUEST_FAILED';
  wait?: MarketData['quoteWait'];
};

export function marketService(
  config: Installation,
  fetchUpstream: FetchUpstream,
  now: () => number,
) {
  const repo = createMarketRepository(config.db);
  const quoteStatus = (active: { version: string } | null): Promise<MarketStatus> =>
    config.alpaca && active
      ? repo.status('alpaca', active.version)
      : Promise.resolve(config.alpaca ? 'NOT_CONFIGURED' : 'DISABLED');
  const fxStatus = (): Promise<MarketStatus> =>
    config.fx ? repo.status('frankfurter') : Promise.resolve('DISABLED');
  async function quoteWait() {
    const timestamp = now();
    const { reason, until } = await repo.quoteWait(timestamp);
    return { reason, retryAt: new Date(until).toISOString(), delayMs: until - timestamp };
  }

  async function settings() {
    const slots = await repo.slots();
    const [quote, fx] = await Promise.all([quoteStatus(slots.active), fxStatus()]);
    return {
      ...slots,
      alpacaEnabled: config.alpaca,
      fxEnabled: config.fx,
      quoteStatus: quote,
      fxStatus: fx,
    };
  }

  async function test(version: string) {
    const candidate = await repo.credential('candidate');
    if (!candidate || candidate.version !== version) return 'CONFLICT';
    const lease = await repo.acquire('alpaca', now(), false);
    if (!lease) return 'RATE_LIMITED';
    let status: 'OK' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'UNAVAILABLE' = 'UNAVAILABLE';
    let retry: ReturnType<typeof upstreamFailure>['retry'] | null = null;
    try {
      if (!(await repo.markTested(version, null))) return 'CONFLICT';
      const credentials = await unsealCredentials(candidate, config.masterKey);
      const health = await new AlpacaProvider(credentials, fetchUpstream, now).healthCheck();
      if (health.status !== 'ok') return status;
      status = 'OK';
      return (await repo.markTested(version, new Date(now()).toISOString())) ? status : 'CONFLICT';
    } catch (error) {
      ({ status, retry } = upstreamFailure(error, now()));
      return status;
    } finally {
      // Candidate checks share quota/backoff but do not change the active feed's displayed status.
      await repo.finish('alpaca', lease, null, now(), retry);
    }
  }

  async function data(symbols: readonly string[], attempt?: QuoteAttempt): Promise<MarketData> {
    const { active } = await repo.slots();
    const [quotes, fx, quote, fxState] = await Promise.all([
      config.alpaca && active ? repo.cache(quoteNamespace(active.version), symbols) : [],
      config.fx ? repo.cache(fxNamespace, [usdThb]) : [],
      quoteStatus(active),
      fxStatus(),
    ]);
    const timestamp = now();
    const parsedFx = FxRateSchema.safeParse(fx[0]);
    const parsedQuotes = quotes
      .map((row) => MarketQuoteSchema.parse(row))
      .map((row) => ({
        ...row,
        stale:
          timestamp - Date.parse(row.asOf) >= quoteInterval ||
          timestamp - Date.parse(row.fetchedAt) >= quoteInterval,
      }));
    const cached = new Map(parsedQuotes.map((row) => [row.symbol, row]));
    const relevantAttempt = active?.version === attempt?.version ? attempt : undefined;
    const quoteResults: NonNullable<MarketData['quoteResults']> = symbols.map((symbol) => {
      const quote = cached.get(symbol);
      if (quote) return { symbol, status: quote.stale ? 'STALE' : 'PRICE' };
      return {
        symbol,
        status: relevantAttempt?.symbols.includes(symbol)
          ? relevantAttempt.status
          : 'NOT_REQUESTED',
      };
    });
    return {
      quoteStatus: quote,
      fxStatus: fxState,
      quotes: parsedQuotes,
      quoteResults,
      ...(relevantAttempt?.wait && {
        quoteLookupStatus: 'DEFERRED',
        quoteWait: relevantAttempt.wait,
      }),
      ...(quoteResults.every(({ status }) => status === 'NO_TRADE') && {
        quoteLookupStatus: 'NO_TRADE',
      }),
      fx: parsedFx.success
        ? {
            ...parsedFx.data,
            stale:
              fxState !== 'OK' ||
              timestamp - Date.parse(parsedFx.data.fetchedAt) >= day ||
              timestamp - Date.parse(parsedFx.data.date) >= 4 * day,
          }
        : null,
    };
  }

  async function refreshQuotes(symbols: readonly string[]): Promise<QuoteAttempt | undefined> {
    if (!config.alpaca) return;
    const active = await repo.credential('active');
    if (!active) return;
    const namespace = quoteNamespace(active.version);
    const timestamp = now();
    const cached = await repo.cache(namespace, symbols);
    const fresh = new Set(
      cached
        .map((quote) => MarketQuoteSchema.parse(quote))
        .filter((quote) => timestamp - Date.parse(quote.fetchedAt) < quoteInterval)
        .map((quote) => quote.symbol),
    );
    const due = symbols.filter((symbol) => !fresh.has(symbol));
    if (!due.length) return;
    const lease = await repo.acquire('alpaca', now(), true);
    if (!lease)
      return {
        version: active.version,
        symbols: due,
        status: 'NOT_REQUESTED',
        wait: await quoteWait(),
      };
    let quotes;
    try {
      const credentials = await unsealCredentials(active, config.masterKey);
      quotes = await new AlpacaProvider(credentials, fetchUpstream, now).getQuotes(
        due.map(quoteRequest),
      );
    } catch (error) {
      const { status, retry } = upstreamFailure(error, now());
      await repo.finish('alpaca', lease, status, now(), retry, [], active.version);
      return {
        version: active.version,
        symbols: due,
        status: 'REQUEST_FAILED',
        ...(retry.rateLimited && { wait: await quoteWait() }),
      };
    }
    await repo.finish(
      'alpaca',
      lease,
      'OK',
      now(),
      null,
      quotes.map((quote) => ({
        namespace,
        symbol: quote.symbol,
        payload: JSON.stringify(quote),
      })),
      active.version,
    );
    const seen = new Set(quotes.map(({ symbol }) => symbol));
    return {
      version: active.version,
      symbols: due.filter((symbol) => !seen.has(symbol)),
      status: 'NO_TRADE',
    };
  }

  async function refreshFx() {
    if (!config.fx) return;
    const lease = await repo.acquire('frankfurter', now(), true);
    if (!lease) return;
    let fx;
    try {
      fx = await fetchReferenceFx(fetchUpstream, now());
    } catch (error) {
      const { status, retry } = upstreamFailure(error, now());
      await repo.finish('frankfurter', lease, status, now(), retry);
      return;
    }
    await repo.finish('frankfurter', lease, 'OK', now(), null, [
      { namespace: fxNamespace, symbol: usdThb, payload: JSON.stringify(fx) },
    ]);
  }

  return {
    settings,
    test,
    data,
    async save(credentials: AlpacaCredentials) {
      await repo.save(await sealCredentials(credentials, config.masterKey));
      return settings();
    },
    activate: (version: string) =>
      repo.activate(version, new Date(now() - 60 * 60_000).toISOString()),
    remove: repo.remove,
    async refresh(symbols: readonly string[]) {
      const [attempt] = await Promise.all([refreshQuotes(symbols), refreshFx()]);
      return data(symbols, attempt);
    },
  };
}
