export { AlpacaProvider, quoteRequest } from './alpaca-provider.js';
export { fetchReferenceFx } from './frankfurter-provider.js';

export const providers = {
  alpaca: { label: 'Alpaca', feed: 'IEX' },
  frankfurter: { label: 'Frankfurter', feed: 'REFERENCE' },
  mock: { label: 'MOCK', feed: 'SYNTHETIC' },
} as const;
