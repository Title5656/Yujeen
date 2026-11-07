import { parseAmount } from './decimal.js';

/** Exact quantity × quote price, in the security currency; no display rounding. */
export function calculateMarketValue(quantity: string, price: string): string {
  const units = parseAmount(quantity, 'quantity', true);
  const unitPrice = parseAmount(price, 'price', false);
  return units.times(unitPrice).toFixed();
}
