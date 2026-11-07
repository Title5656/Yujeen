import Decimal from 'decimal.js';

// Isolate financial arithmetic from callers changing Decimal's global settings.
export const FinancialDecimal = Decimal.clone({ precision: 96, rounding: Decimal.ROUND_HALF_EVEN });
const decimalInput = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,12})?$/;

export function parseAmount(value: string, field: string, allowZero: boolean): Decimal {
  if (typeof value !== 'string' || !decimalInput.test(value)) {
    throw new RangeError(
      `${field} must be a decimal string with up to 18 integer and 12 fractional digits`,
    );
  }
  const amount = new FinancialDecimal(value);
  if (!allowZero && amount.isZero()) throw new RangeError(`${field} must be greater than zero`);
  return amount;
}

/** Allocation precision is finer than input precision; final depletion consumes the residual. */
export function roundCost(value: Decimal): Decimal {
  return value.toDecimalPlaces(24, FinancialDecimal.ROUND_HALF_EVEN);
}
