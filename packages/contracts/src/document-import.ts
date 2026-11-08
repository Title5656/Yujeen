import { z } from 'zod';

export const IMPORT_LIMITS = Object.freeze({
  fileBytes: 10 * 1024 * 1024,
  pages: 20,
  textCharacters: 500_000,
  lines: 10_000,
  items: 50_000,
  rows: 100,
  timeoutMs: 15_000,
});
const PositiveInteger = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const TextPositionSchema = z.strictObject({
  text: z.string().min(1).max(IMPORT_LIMITS.textCharacters),
  line: PositiveInteger,
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(0),
  height: z.number().finite().min(0),
});
export const ExtractedDocumentSchema = z
  .strictObject({
    documentSha256: Hash,
    method: z.enum(['PDF_TEXT', 'OCR']),
    pages: z
      .array(
        z.strictObject({
          page: PositiveInteger.max(IMPORT_LIMITS.pages),
          items: z.array(TextPositionSchema).max(IMPORT_LIMITS.items).optional(),
          lines: z
            .array(
              z.strictObject({
                line: PositiveInteger,
                text: z.string().max(IMPORT_LIMITS.textCharacters),
                confidence: z.number().min(0).max(1),
              }),
            )
            .max(IMPORT_LIMITS.lines),
        }),
      )
      .min(1)
      .max(IMPORT_LIMITS.pages),
    issues: z.array(z.enum(['OCR_REQUIRED', 'LOW_CONFIDENCE'])).max(IMPORT_LIMITS.pages),
  })
  .superRefine((document, ctx) => {
    let characters = 0;
    let lines = 0;
    let itemCount = 0;
    const pages = new Set<number>();
    for (const page of document.pages) {
      if (pages.has(page.page)) ctx.addIssue({ code: 'custom', message: 'Duplicate page' });
      pages.add(page.page);
      const lineIds = new Set<number>();
      for (const line of page.lines) {
        if (lineIds.has(line.line)) ctx.addIssue({ code: 'custom', message: 'Duplicate line' });
        lineIds.add(line.line);
        characters += line.text.length;
        lines += 1;
      }
      const byLine = new Map(page.lines.map((line) => [line.line, line.text]));
      itemCount += page.items?.length ?? 0;
      for (const item of page.items ?? []) {
        if (!byLine.get(item.line)?.includes(item.text))
          ctx.addIssue({ code: 'custom', message: 'Position must reference its source line' });
      }
    }
    if (
      characters > IMPORT_LIMITS.textCharacters ||
      lines > IMPORT_LIMITS.lines ||
      itemCount > IMPORT_LIMITS.items
    )
      ctx.addIssue({ code: 'custom', message: 'TEXT_LIMIT' });
  });

export const TRADE_DOCUMENT_FIELDS = [
  'symbol',
  'market',
  'currency',
  'feeCurrency',
  'side',
  'tradeStatus',
  'executedAt',
  'sequence',
  'quantity',
  'executionPrice',
  'fee',
  'tax',
  'externalRef',
  'referenceKind',
] as const;
export const TradeDocumentFieldSchema = z.enum(TRADE_DOCUMENT_FIELDS);
const RawField = z.string().max(256).nullable();
const Evidence = z.strictObject({
  page: PositiveInteger.max(IMPORT_LIMITS.pages),
  line: PositiveInteger,
  confidence: z.number().min(0).max(1),
});
export const DocumentOrderSchema = z.strictObject({
  orderId: RawField,
  effectiveDate: RawField,
  settlementDate: RawField,
  unitPrice: RawField,
  grossAmount: RawField,
  netAmount: RawField,
  exchange: RawField,
  thbAmounts: z.strictObject({
    grossAmount: RawField,
    fee: RawField,
    tax: RawField,
    netAmount: RawField,
  }),
  evidence: z.record(z.string().max(64), Evidence),
});
export const RawTradeFieldsSchema = z.strictObject({
  symbol: RawField,
  market: RawField,
  currency: RawField,
  feeCurrency: RawField,
  side: RawField,
  tradeStatus: RawField,
  executedAt: RawField,
  sequence: RawField,
  quantity: RawField,
  executionPrice: RawField,
  fee: RawField,
  tax: RawField,
  externalRef: RawField,
  referenceKind: RawField,
});
export const DraftTradeSchema = z.strictObject({
  sourceRow: PositiveInteger.max(IMPORT_LIMITS.rows),
  fields: RawTradeFieldsSchema,
  documentOrder: DocumentOrderSchema.optional(),
  evidence: z.partialRecord(
    TradeDocumentFieldSchema,
    z.strictObject({
      page: PositiveInteger.max(IMPORT_LIMITS.pages),
      line: PositiveInteger,
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export const ParsedDocumentImportSchema = z.strictObject({
  documentSha256: Hash,
  parserId: z.enum(['dime-unverified', 'synthetic-dime', 'dime-confirmation']),
  parserVersion: z.enum(['dime-unverified-v1', 'synthetic-dime-v1', 'dime-confirmation-v1']),
  dataMode: z.enum(['DOCUMENT', 'MOCK']),
  formatVerified: z.boolean(),
  issues: z.array(z.string().max(128)).max(100),
  drafts: z.array(DraftTradeSchema).max(IMPORT_LIMITS.rows),
});
const Identifier = z
  .string()
  .min(1)
  .max(256)
  .refine((s) => s.trim() === s);
export const ImportContextSchema = z.strictObject({
  accountId: Identifier,
  securities: z
    .array(
      z.strictObject({
        symbol: Identifier,
        market: z.literal('US'),
        currency: z.literal('USD'),
        securityId: Identifier,
      }),
    )
    .max(1000),
});

export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;
export type TextPosition = z.infer<typeof TextPositionSchema>;
export type RawTradeFields = z.infer<typeof RawTradeFieldsSchema>;
export type TradeDocumentField = z.infer<typeof TradeDocumentFieldSchema>;
export type DraftTrade = z.infer<typeof DraftTradeSchema>;
export type ParsedDocumentImport = z.infer<typeof ParsedDocumentImportSchema>;
export type ImportContext = z.infer<typeof ImportContextSchema>;
