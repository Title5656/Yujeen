import { z } from 'zod';
import { PositiveDecimalStringSchema } from './decimal.js';

/** Synthetic fixture protocol; intentionally unrelated to Dime PDF structure. */
export const MockImportDocumentSchema = z.strictObject({
  format: z.literal('portfolio-mock-v1'),
  symbol: z.string().min(1),
  quantity: PositiveDecimalStringSchema.nullable(),
  executionPrice: PositiveDecimalStringSchema.nullable(),
  tradeStatus: z.enum(['FILLED', 'PENDING', 'CANCELLED']),
});
export type MockImportDocument = z.infer<typeof MockImportDocumentSchema>;
