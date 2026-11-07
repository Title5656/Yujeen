import type { MarketQuote } from '@portfolio/contracts';
import type { Market, SecurityIdentity } from '@portfolio/domain';

export type QuoteRequest = SecurityIdentity;

export interface ConnectionHealth {
  readonly status: 'ok' | 'unavailable';
  readonly dataMode: 'MOCK';
}

export interface MarketDataProvider {
  readonly id: string;
  supportedMarkets(): readonly Market[];
  healthCheck(): Promise<ConnectionHealth>;
  getQuotes(requests: readonly QuoteRequest[]): Promise<readonly MarketQuote[]>;
}

export type MarketDataErrorCode =
  'RATE_LIMITED' | 'AUTH_FAILED' | 'UNSUPPORTED' | 'NETWORK' | 'STALE_DATA' | 'PROVIDER_ERROR';

export class MarketDataError extends Error {
  constructor(
    readonly code: MarketDataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}
