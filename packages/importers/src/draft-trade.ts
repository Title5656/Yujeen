import {
  TRADE_DOCUMENT_FIELDS,
  TradeSchema,
  type DraftTrade,
  type ImportContext,
  type PreviewRow,
} from '@portfolio/contracts';
import { dimeUsTradeDate, normalizeExecutedAt, validateTrade } from '@portfolio/domain';
import { reviewDocumentOrder } from './review-document-order.js';

export function reviewDraft(
  draft: DraftTrade,
  context: ImportContext,
  importBatchId: string,
): PreviewRow {
  if (draft.documentOrder) return reviewDocumentOrder(draft, context, importBatchId);
  const fields = draft.fields;
  const issues: string[] = [];
  if (fields.tradeStatus !== null && fields.tradeStatus !== 'FILLED')
    return { draft, issues: ['NOT_FILLED'], status: 'NOT_FILLED', trade: null };
  for (const field of TRADE_DOCUMENT_FIELDS) {
    if (fields[field] === null || fields[field]?.trim() === '') issues.push(`MISSING:${field}`);
    else if (!draft.evidence[field]) issues.push(`NO_EVIDENCE:${field}`);
    else if (draft.evidence[field]!.confidence < 0.98) issues.push(`LOW_CONFIDENCE:${field}`);
  }
  if (fields.referenceKind !== null && fields.referenceKind !== 'FILL')
    issues.push('INVALID:referenceKind');
  const sequence =
    fields.sequence !== null && /^(?:0|[1-9]\d*)$/.test(fields.sequence)
      ? Number(fields.sequence)
      : NaN;
  if (fields.sequence !== null && !Number.isSafeInteger(sequence)) issues.push('INVALID:sequence');
  const mappings = context.securities.filter(
    (security) =>
      security.symbol === fields.symbol &&
      security.market === fields.market &&
      security.currency === fields.currency,
  );
  if (mappings.length !== 1) issues.push('SECURITY_MAPPING_REQUIRED');
  let executedAt: string | undefined;
  try {
    if (fields.executedAt !== null) executedAt = normalizeExecutedAt(fields.executedAt);
  } catch {
    issues.push('INVALID:executedAt');
  }
  const candidate = TradeSchema.safeParse({
    id: `${importBatchId}:row:${draft.sourceRow}`,
    accountId: context.accountId,
    securityId: mappings[0]?.securityId,
    importBatchId,
    sourceRow: draft.sourceRow,
    broker: 'DIME',
    market: fields.market,
    currency: fields.currency,
    status: fields.tradeStatus,
    side: fields.side,
    executedAt,
    sequence,
    tradeDate: executedAt ? dimeUsTradeDate(executedAt) : null,
    quantity: fields.quantity,
    executionPrice: fields.executionPrice,
    fee: fields.fee,
    tax: fields.tax,
    feeCurrency: fields.feeCurrency,
    externalRef: fields.externalRef,
  });
  if (!candidate.success) {
    for (const issue of candidate.error.issues)
      issues.push(`INVALID:${String(issue.path[0] ?? 'trade')}`);
  }
  const uniqueIssues = [...new Set(issues)];
  return {
    draft,
    status: uniqueIssues.length === 0 ? 'READY' : 'NEEDS_REVIEW',
    issues: uniqueIssues,
    trade: candidate.success && uniqueIssues.length === 0 ? validateTrade(candidate.data) : null,
  };
}
