import { z } from 'zod';
import { PositiveDecimalStringSchema } from './decimal.js';
import { MarketQuoteSchema } from './market-quote.js';

const credential = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
export const AlpacaCredentialsSchema = z.strictObject({
  provider: z.literal('alpaca'),
  keyId: credential,
  secret: credential,
});
export type AlpacaCredentials = z.infer<typeof AlpacaCredentialsSchema>;

export const VersionInputSchema = z.strictObject({ version: z.uuid() });
const CandidateSchema = VersionInputSchema.extend({ testedAt: z.iso.datetime().nullable() });

export const FxRateSchema = z.strictObject({
  base: z.literal('USD'),
  quote: z.literal('THB'),
  rate: PositiveDecimalStringSchema,
  date: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  source: z.literal('frankfurter-blended'),
  dataMode: z.literal('LIVE'),
});
export type FxRate = z.infer<typeof FxRateSchema>;

const SymbolSchema = z.string().regex(/^[A-Z][A-Z0-9.-]{0,14}$/);
export const SymbolsInputSchema = z.strictObject({ symbols: z.array(SymbolSchema).min(1).max(20) });

export const MarketStatusSchema = z.enum([
  'OK',
  'DISABLED',
  'NOT_CONFIGURED',
  'UNAVAILABLE',
  'RATE_LIMITED',
  'AUTH_FAILED',
]);
export type MarketStatus = z.infer<typeof MarketStatusSchema>;
export const IntegrationsSchema = z.strictObject({
  alpacaEnabled: z.boolean(),
  fxEnabled: z.boolean(),
  active: CandidateSchema.nullable(),
  candidate: CandidateSchema.nullable(),
  quoteStatus: MarketStatusSchema,
  fxStatus: MarketStatusSchema,
});
export type Integrations = z.infer<typeof IntegrationsSchema>;

const QuoteWaitSchema = z.strictObject({
  reason: z.enum([
    'COOLDOWN',
    'IN_PROGRESS',
    'UPSTREAM_RATE_LIMIT',
    'DAILY_QUOTA',
    'MONTHLY_QUOTA',
  ]),
  retryAt: z.iso.datetime(),
  delayMs: z.number().int().nonnegative(),
});

const QuoteResultSchema = z.strictObject({
  symbol: SymbolSchema,
  status: z.enum(['PRICE', 'STALE', 'NOT_REQUESTED', 'NO_TRADE', 'REQUEST_FAILED']),
});

export const MarketDataSchema = z.strictObject({
  quotes: z.array(MarketQuoteSchema.safeExtend({ stale: z.boolean() })),
  fx: FxRateSchema.extend({ stale: z.boolean() }).nullable(),
  quoteStatus: MarketStatusSchema,
  quoteLookupStatus: z.enum(['DEFERRED', 'NO_TRADE']).optional(),
  quoteWait: QuoteWaitSchema.optional(),
  quoteResults: z.array(QuoteResultSchema).optional(),
  fxStatus: MarketStatusSchema,
});
export type MarketData = z.infer<typeof MarketDataSchema>;
