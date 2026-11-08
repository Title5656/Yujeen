import { FinancialDecimal as D } from './decimal.js';

interface TradeFields {
  readonly id: string;
  readonly accountId: string;
  readonly securityId: string;
  readonly broker: 'DIME';
  readonly market: 'US';
  readonly currency: 'USD';
  readonly side: 'BUY' | 'SELL';
  readonly tradeDate: string;
  readonly quantity: string;
  readonly fee: string;
  readonly tax: string;
  readonly feeCurrency: 'USD';
  readonly externalRef: string | null;
  readonly importBatchId: string;
  readonly sourceRow: number;
}

/** Legacy M1 execution record. Its wire representation and v1 identity are unchanged. */
export interface ExecutionTrade extends TradeFields {
  readonly status: 'FILLED';
  readonly executedAt: string;
  readonly sequence: number;
  readonly executionPrice: string;
}

/** Confirmed order summary; documentary day and rounded unit price are not a fill. */
export interface DocumentOrderTrade extends TradeFields {
  readonly precision: 'DOCUMENT_DATE';
  readonly status: 'CONFIRMED';
  readonly executedAt: null;
  readonly sequence: null;
  readonly executionPrice: null;
  readonly externalRef: string;
  readonly unitPrice: string;
  readonly grossAmount: string;
  readonly netAmount: string;
}

export type Trade = ExecutionTrade | DocumentOrderTrade;

export interface ImportBatch {
  readonly id: string;
  readonly accountId: string;
  readonly documentSha256: string;
  readonly parserVersion: string;
  readonly confirmedAt: string;
}

export interface ConfirmedTradeBatch {
  readonly batch: ImportBatch;
  readonly trades: readonly Trade[];
}

export interface TradeAlias {
  readonly id: string;
  readonly accountId: string;
  readonly externalRef: string | null;
  readonly importBatchId: string;
  readonly sourceRow: number;
  readonly fingerprint: string;
}

const decimalPattern = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,12})?$/;
const instantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const tradingDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function requireIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim() !== value) {
    throw new Error(`${field} must be a nonempty identifier without surrounding whitespace`);
  }
}

function normalizeDecimal(value: unknown, field: string, positive = false): string {
  if (
    typeof value !== 'string' ||
    !decimalPattern.test(value) ||
    (positive && !/[1-9]/.test(value))
  ) {
    throw new Error(`${field} must be a ${positive ? 'positive' : 'nonnegative'} decimal string`);
  }
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

export function validateTrade(input: Trade): Trade {
  if (!input || typeof input !== 'object') throw new Error('Trade must be an object');
  for (const field of ['id', 'accountId', 'securityId', 'importBatchId'] as const) {
    requireIdentifier(input[field], field);
  }
  if (input.externalRef !== null) requireIdentifier(input.externalRef, 'externalRef');
  if (
    input.broker !== 'DIME' ||
    input.market !== 'US' ||
    input.currency !== 'USD' ||
    input.feeCurrency !== 'USD'
  ) {
    throw new Error('Only DIME US trades and fees denominated in USD are supported');
  }
  if (input.side !== 'BUY' && input.side !== 'SELL') throw new Error('Trade side is invalid');
  if (!Number.isSafeInteger(input.sourceRow) || input.sourceRow < 1) {
    throw new Error('sourceRow must be a positive safe integer');
  }
  if (input.status === 'CONFIRMED') {
    if (
      input.precision !== 'DOCUMENT_DATE' ||
      input.executedAt !== null ||
      input.sequence !== null ||
      input.executionPrice !== null
    ) {
      throw new Error(
        'A documentary order cannot contain an invented execution time, sequence or price',
      );
    }
    requireIdentifier(input.externalRef, 'externalRef');
    if (!isDocumentTradeDate(input.tradeDate))
      throw new Error('tradeDate must be a real documentary calendar day');
    const quantity = normalizeDecimal(input.quantity, 'quantity', true);
    const unitPrice = normalizeDecimal(input.unitPrice, 'unitPrice', true);
    const grossAmount = normalizeDecimal(input.grossAmount, 'grossAmount', true);
    const netAmount = normalizeDecimal(input.netAmount, 'netAmount');
    const fee = normalizeDecimal(input.fee, 'fee');
    const tax = normalizeDecimal(input.tax, 'tax');
    const expectedNet =
      input.side === 'BUY'
        ? new D(grossAmount).plus(fee).plus(tax)
        : new D(grossAmount).minus(fee).minus(tax);
    if (!expectedNet.eq(netAmount))
      throw new Error('Reported net amount does not match gross amount, fee and withholding tax');
    return {
      id: input.id,
      accountId: input.accountId,
      securityId: input.securityId,
      broker: input.broker,
      market: input.market,
      currency: input.currency,
      precision: 'DOCUMENT_DATE',
      status: 'CONFIRMED',
      side: input.side,
      executedAt: null,
      sequence: null,
      executionPrice: null,
      tradeDate: input.tradeDate,
      quantity,
      unitPrice,
      grossAmount,
      netAmount,
      fee,
      tax,
      feeCurrency: input.feeCurrency,
      externalRef: input.externalRef,
      importBatchId: input.importBatchId,
      sourceRow: input.sourceRow,
    };
  }
  if (input.status !== 'FILLED' || ('precision' in input && input.precision !== undefined))
    throw new Error('Only FILLED executions or CONFIRMED documentary orders can enter the ledger');
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) {
    throw new Error('sequence must be a nonnegative safe integer');
  }
  const executedAt = normalizeExecutedAt(input.executedAt);
  if (input.tradeDate !== dimeUsTradeDate(executedAt)) {
    throw new Error('tradeDate must equal the execution date in America/New_York');
  }
  return {
    id: input.id,
    accountId: input.accountId,
    securityId: input.securityId,
    broker: input.broker,
    market: input.market,
    currency: input.currency,
    status: input.status,
    side: input.side,
    executedAt,
    sequence: input.sequence,
    tradeDate: input.tradeDate,
    quantity: normalizeDecimal(input.quantity, 'quantity', true),
    executionPrice: normalizeDecimal(input.executionPrice, 'executionPrice', true),
    fee: normalizeDecimal(input.fee, 'fee'),
    tax: normalizeDecimal(input.tax, 'tax'),
    feeCurrency: input.feeCurrency,
    externalRef: input.externalRef,
    importBatchId: input.importBatchId,
    sourceRow: input.sourceRow,
  };
}

export function isDocumentTradeDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximum = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return year >= 1 && maximum !== undefined && day >= 1 && day <= maximum;
}

export function normalizeExecutedAt(value: string): string {
  const match = typeof value === 'string' ? instantPattern.exec(value) : null;
  if (!match) throw new Error('An execution instant requires an ISO timestamp with an offset');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const offset = match[8] ?? '';
  if (
    year < 1 ||
    !daysInMonth ||
    day < 1 ||
    day > daysInMonth ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59 ||
    (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59))
  ) {
    throw new Error('Execution timestamp contains an invalid calendar date or time');
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('Execution timestamp is invalid');
  return new Date(milliseconds).toISOString();
}

export function dimeUsTradeDate(value: string): string {
  const parts = tradingDayFormatter.formatToParts(new Date(normalizeExecutedAt(value)));
  const year = parts.find((part) => part.type === 'year')?.value.padStart(4, '0');
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function tradeFingerprint(trade: Trade): string {
  const normalized = validateTrade(trade);
  if (normalized.status === 'CONFIRMED') {
    return `trade:v2:${JSON.stringify([
      normalized.precision,
      normalized.broker,
      normalized.market,
      normalized.accountId,
      normalized.securityId,
      normalized.side,
      normalized.tradeDate,
      normalized.externalRef,
      normalized.quantity,
      normalized.unitPrice,
      normalized.grossAmount,
      normalized.netAmount,
      normalized.fee,
      normalized.tax,
      normalized.currency,
      normalized.feeCurrency,
    ])}`;
  }
  return `trade:v1:${JSON.stringify([
    normalized.broker,
    normalized.market,
    normalized.accountId,
    normalized.securityId,
    normalized.side,
    normalized.executedAt,
    normalized.sequence,
    normalized.quantity,
    normalized.executionPrice,
    normalized.fee,
    normalized.tax,
    normalized.currency,
    normalized.feeCurrency,
  ])}`;
}
