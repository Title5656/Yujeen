import { z } from 'zod';
import { DecimalStringSchema, PositiveDecimalStringSchema } from './decimal.js';

const instantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const tradingDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function isRealOffsetInstant(value: string): boolean {
  const match = instantPattern.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const offset = match[8] ?? '';
  return (
    year >= 1 &&
    daysInMonth !== undefined &&
    day >= 1 &&
    day <= daysInMonth &&
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    Number(match[6]) <= 59 &&
    (offset === 'Z' || (Number(offset.slice(1, 3)) <= 23 && Number(offset.slice(4, 6)) <= 59)) &&
    Number.isFinite(Date.parse(value))
  );
}

function normalizedDecimal(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

function tradingDay(value: string): string {
  const parts = tradingDayFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value.padStart(4, '0');
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

const IdentifierSchema = z
  .string()
  .refine((value) => value.trim().length > 0 && value.trim() === value, 'Invalid identifier');
const OffsetInstantSchema = z
  .string()
  .refine(isRealOffsetInstant, 'A real ISO calendar instant with an offset is required')
  .transform((value) => new Date(value).toISOString());

export const ExecutionTradeSchema = z
  .strictObject({
    id: IdentifierSchema,
    accountId: IdentifierSchema,
    securityId: IdentifierSchema,
    broker: z.literal('DIME'),
    market: z.literal('US'),
    currency: z.literal('USD'),
    status: z.literal('FILLED'),
    side: z.enum(['BUY', 'SELL']),
    executedAt: OffsetInstantSchema,
    sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    quantity: PositiveDecimalStringSchema.transform(normalizedDecimal),
    executionPrice: PositiveDecimalStringSchema.transform(normalizedDecimal),
    fee: DecimalStringSchema.transform(normalizedDecimal),
    tax: DecimalStringSchema.transform(normalizedDecimal),
    feeCurrency: z.literal('USD'),
    externalRef: IdentifierSchema.nullable(),
    importBatchId: IdentifierSchema,
    sourceRow: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .superRefine((trade, context) => {
    if (!isRealOffsetInstant(trade.executedAt)) return;
    if (trade.tradeDate !== tradingDay(trade.executedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['tradeDate'],
        message: 'tradeDate must equal the execution date in America/New_York',
      });
    }
  });

function documentaryDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximum = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return year >= 1 && maximum !== undefined && day >= 1 && day <= maximum;
}

// Inputs have at most twelve fractional digits. A common integer scale makes the
// reported cash equation exact without floating point or another dependency.
function scaledAmount(value: string): bigint {
  const [integer = '0', fraction = ''] = value.split('.');
  return BigInt(integer) * 1_000_000_000_000n + BigInt(fraction.padEnd(12, '0'));
}

export const DocumentOrderTradeSchema = z
  .strictObject({
    id: IdentifierSchema,
    accountId: IdentifierSchema,
    securityId: IdentifierSchema,
    broker: z.literal('DIME'),
    market: z.literal('US'),
    currency: z.literal('USD'),
    precision: z.literal('DOCUMENT_DATE'),
    status: z.literal('CONFIRMED'),
    side: z.enum(['BUY', 'SELL']),
    executedAt: z.null(),
    sequence: z.null(),
    executionPrice: z.null(),
    tradeDate: z.string().refine(documentaryDay, 'A real documentary calendar day is required'),
    quantity: PositiveDecimalStringSchema.transform(normalizedDecimal),
    unitPrice: PositiveDecimalStringSchema.transform(normalizedDecimal),
    grossAmount: PositiveDecimalStringSchema.transform(normalizedDecimal),
    netAmount: DecimalStringSchema.transform(normalizedDecimal),
    fee: DecimalStringSchema.transform(normalizedDecimal),
    tax: DecimalStringSchema.transform(normalizedDecimal),
    feeCurrency: z.literal('USD'),
    externalRef: IdentifierSchema,
    importBatchId: IdentifierSchema,
    sourceRow: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .superRefine((trade, context) => {
    // Regex failures are continuable Zod issues. Never feed malformed strings into BigInt.
    if (
      [trade.grossAmount, trade.netAmount, trade.fee, trade.tax].some(
        (amount) => !DecimalStringSchema.safeParse(amount).success,
      )
    )
      return;
    const gross = scaledAmount(trade.grossAmount);
    const charges = scaledAmount(trade.fee) + scaledAmount(trade.tax);
    if (
      scaledAmount(trade.netAmount) !== (trade.side === 'BUY' ? gross + charges : gross - charges)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['netAmount'],
        message: 'Reported net amount must equal gross plus buy charges or minus sell charges',
      });
    }
  });

export const TradeSchema = z.discriminatedUnion('status', [
  ExecutionTradeSchema,
  DocumentOrderTradeSchema,
]);

export const ImportBatchSchema = z.strictObject({
  id: IdentifierSchema,
  accountId: IdentifierSchema,
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  parserVersion: IdentifierSchema,
  confirmedAt: OffsetInstantSchema,
});

export const ConfirmedTradeBatchSchema = z
  .strictObject({ batch: ImportBatchSchema, trades: z.array(TradeSchema) })
  .superRefine(({ batch, trades }, context) => {
    trades.forEach((trade, index) => {
      if (trade.accountId !== batch.accountId || trade.importBatchId !== batch.id) {
        context.addIssue({
          code: 'custom',
          path: ['trades', index],
          message: 'A confirmed trade must belong to this import batch and account',
        });
      }
    });
  });

export type Trade = z.infer<typeof TradeSchema>;
export type ExecutionTrade = z.infer<typeof ExecutionTradeSchema>;
export type DocumentOrderTrade = z.infer<typeof DocumentOrderTradeSchema>;
export type ImportBatch = z.infer<typeof ImportBatchSchema>;
export type ConfirmedTradeBatch = z.infer<typeof ConfirmedTradeBatchSchema>;
