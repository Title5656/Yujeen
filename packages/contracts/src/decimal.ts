import { z } from 'zod';

export const DecimalStringSchema = z.string().regex(/^(?:0|[1-9]\d{0,17})(?:\.\d{1,12})?$/);
export const PositiveDecimalStringSchema = DecimalStringSchema.refine(
  (value) => /[1-9]/.test(value),
  'Must be greater than zero',
);
