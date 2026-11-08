import { z } from 'zod';
import {
  DraftTradeSchema,
  ExtractedDocumentSchema,
  ImportContextSchema,
  IMPORT_LIMITS,
} from './document-import.js';
import { TradeSchema } from './trade.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const PreviewRowSchema = z.strictObject({
  draft: DraftTradeSchema,
  status: z.enum(['READY', 'DUPLICATE', 'NEEDS_REVIEW', 'NOT_FILLED']),
  issues: z.array(z.string().max(128)).max(100),
  trade: TradeSchema.nullable(),
});
export const ImportPreviewSchema = z.strictObject({
  status: z.enum(['READY', 'DUPLICATE', 'NEEDS_REVIEW']),
  canConfirm: z.boolean(),
  dataMode: z.enum(['MOCK', 'DOCUMENT']),
  documentSha256: Hash,
  parserVersion: z.string().min(1).max(128),
  importBatchId: z.string().min(1).max(1024),
  ledgerRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  reviewDigest: Hash,
  issues: z.array(z.string().max(128)).max(100),
  rows: z.array(PreviewRowSchema).max(IMPORT_LIMITS.rows),
});
export const PreviewImportInputSchema = z.strictObject({
  document: ExtractedDocumentSchema,
  parserId: z.enum(['dime-unverified', 'synthetic-dime', 'dime-confirmation']),
  context: ImportContextSchema,
});
export const ConfirmImportInputSchema = z.strictObject({
  request: PreviewImportInputSchema,
  reviewed: z.literal(true),
  reviewDigest: Hash,
  reviewedSourceRows: z
    .array(z.number().int().min(1).max(IMPORT_LIMITS.rows))
    .min(1)
    .max(IMPORT_LIMITS.rows),
  confirmedAt: z.string().min(1).max(40),
});
export type PreviewRow = z.infer<typeof PreviewRowSchema>;
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;
export type PreviewImportInput = z.infer<typeof PreviewImportInputSchema>;
