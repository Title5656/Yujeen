import { FxRateSchema } from '@portfolio/contracts';
import type { FxRate } from '@portfolio/contracts';
import { MarketDataError } from './provider.js';
import { requestJson, object, decimal } from './http.js';
import type { Transport } from './http.js';

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
