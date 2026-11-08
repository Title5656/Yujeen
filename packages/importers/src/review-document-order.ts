import {
  TradeSchema,
  type DraftTrade,
  type ImportContext,
  type PreviewRow,
} from '@portfolio/contracts';
import { validateTrade } from '@portfolio/domain';

export function reviewDocumentOrder(
  draft: DraftTrade,
  context: ImportContext,
  importBatchId: string,
): PreviewRow {
  const order = draft.documentOrder!;
  const issues: string[] = [];
  const required = [
    'symbol',
    'market',
    'side',
    'quantity',
    'currency',
    'feeCurrency',
    'fee',
    'tax',
  ] as const;
  for (const field of required) {
    if (!draft.fields[field]) issues.push(`MISSING:${field}`);
    else if (!draft.evidence[field] || draft.evidence[field]!.confidence < 0.98)
      issues.push(`LOW_CONFIDENCE:${field}`);
  }
  for (const field of [
    'orderId',
    'effectiveDate',
    'unitPrice',
    'grossAmount',
    'netAmount',
  ] as const) {
    if (!order[field]) issues.push(`MISSING:${field}`);
    else if (!order.evidence[field] || order.evidence[field]!.confidence < 0.98)
      issues.push(`LOW_CONFIDENCE:${field}`);
  }
  const matches = context.securities.filter(
    (s) =>
      s.symbol === draft.fields.symbol &&
      s.market === draft.fields.market &&
      s.currency === draft.fields.currency,
  );
  if (matches.length !== 1) issues.push('SECURITY_MAPPING_REQUIRED');
  const candidate = TradeSchema.safeParse({
    id: `${importBatchId}:row:${draft.sourceRow}`,
    accountId: context.accountId,
    securityId: matches[0]?.securityId,
    broker: 'DIME',
    market: draft.fields.market,
    currency: draft.fields.currency,
    feeCurrency: draft.fields.feeCurrency,
    status: 'CONFIRMED',
    precision: 'DOCUMENT_DATE',
    executedAt: null,
    sequence: null,
    executionPrice: null,
    tradeDate: order.effectiveDate,
    side: draft.fields.side,
    quantity: draft.fields.quantity,
    unitPrice: order.unitPrice,
    grossAmount: order.grossAmount,
    netAmount: order.netAmount,
    fee: draft.fields.fee,
    tax: draft.fields.tax,
    importBatchId,
    sourceRow: draft.sourceRow,
    externalRef:
      order.orderId && order.effectiveDate && matches[0] ? `dime-order:v1:${order.orderId}` : null,
  });
  let trade: PreviewRow['trade'] = null;
  if (!candidate.success) {
    issues.push(...candidate.error.issues.map((i) => `INVALID:${String(i.path[0] ?? 'amounts')}`));
  } else if (issues.length === 0) {
    try {
      trade = validateTrade(candidate.data);
    } catch {
      issues.push('AMOUNTS_DO_NOT_RECONCILE');
    }
  }
  return { draft, trade, issues: [...new Set(issues)], status: trade ? 'READY' : 'NEEDS_REVIEW' };
}
