import { describe, expect, it } from 'vitest';
import { calculateMarketValue } from './index.js';

describe('calculateMarketValue (decimal strings)', () => {
  it.each([
    ['0.1', '0.2', '0.02'],
    ['0.123456789012', '123.45', '15.2407406035314'],
    ['0', '100', '0'],
    ['2.5', '10.04', '25.1'],
    ['999999999999999999', '999999999999999999', '999999999999999998000000000000000001'],
  ])('values %s units at %s exactly as %s', (quantity, price, expected) => {
    expect(calculateMarketValue(quantity, price)).toBe(expected);
  });

  it.each(['-1', 'NaN', 'Infinity', '1e3', '', ' 1 ', '0.0000000000001', '1000000000000000000'])(
    'rejects invalid quantity %j',
    (quantity) => {
      expect(() => calculateMarketValue(quantity, '10')).toThrow();
    },
  );

  it.each(['0', '-1', 'NaN', 'Infinity', '1e3', '', '0.0000000000001'])(
    'rejects invalid price %j',
    (price) => {
      expect(() => calculateMarketValue('1', price)).toThrow();
    },
  );
});
