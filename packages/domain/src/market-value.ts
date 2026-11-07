import Decimal from 'decimal.js';

// Each operand has at most 30 digits; 64 digits preserves its exact product.
// Clone avoids changing global decimal.js configuration in other packages.
const FinancialDecimal = Decimal.clone({ precision: 64, rounding: Decimal.ROUND_HALF_EVEN });
const decimalInput = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,12})?$/;

function parseAmount(value: string, field: string, allowZero: boolean): Decimal {
  if (typeof value !== 'string' || !decimalInput.test(value)) {
    throw new RangeError(
      `${field} must be a decimal string with up to 18 integer and 12 fractional digits`,
    );
  }
  const amount = new FinancialDecimal(value);
  if (!allowZero && amount.isZero()) {
    throw new RangeError(`${field} must be greater than zero`);
  }
  return amount;
}

/** M0 example only: no ledger, cost basis, FX, fee allocation or display rounding. */
export function calculateMarketValue(quantity: string, price: string): string {
  const units = parseAmount(quantity, 'quantity', true);
  const unitPrice = parseAmount(price, 'price', false);
  return units.times(unitPrice).toFixed();
}
