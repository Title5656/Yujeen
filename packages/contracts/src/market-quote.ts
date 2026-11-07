import { z } from 'zod';
import { PositiveDecimalStringSchema } from './decimal.js';

export const MarketQuoteSchema = z.strictObject({
  securityId: z.string().min(1),
  symbol: z.string().min(1),
  market: z.enum(['US', 'TH']),
  currency: z.enum(['USD', 'THB']),
  price: PositiveDecimalStringSchema,
  priceType: z.enum(['LAST', 'CLOSE']),
  feed: z.string().min(1),
  source: z.string().min(1),
  asOf: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
  quality: z.enum(['REALTIME', 'DELAYED', 'EOD', 'UNKNOWN']),
  // M0 accepts synthetic data only. Extend deliberately when real adapters are added in M3.
  dataMode: z.literal('MOCK'),
});
export type MarketQuote = z.infer<typeof MarketQuoteSchema>;
