import { z } from 'zod';
import { PositiveDecimalStringSchema } from './decimal.js';

export const MarketQuoteSchema = z
  .strictObject({
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
    dataMode: z.enum(['MOCK', 'LIVE']),
  })
  .refine(
    (quote) =>
      quote.dataMode === 'MOCK' ||
      (quote.market === 'US' &&
        quote.currency === 'USD' &&
        quote.source === 'alpaca' &&
        quote.feed === 'IEX'),
    'Live market data must come from a supported provider and feed',
  );
export type MarketQuote = z.infer<typeof MarketQuoteSchema>;
