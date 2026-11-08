import {
  ImportContextSchema,
  ImportPreviewSchema,
  ParsedDocumentImportSchema,
  type ImportPreview,
  type PreviewRow,
} from '@portfolio/contracts';
import {
  LedgerConflictError,
  mergeLedger,
  rebuildPositions,
  tradeFingerprint,
  assertCompatibleTradeEvidence,
  type LedgerSnapshot,
  type Trade,
} from '@portfolio/domain';
import { documentSha256 } from './extraction.js';
import { reviewDraft } from './draft-trade.js';

/** No writes. Preview is advisory; confirmation must reparse and re-read the ledger. */
export async function buildImportPreview(
  input: unknown,
  inputContext: unknown,
  snapshot: LedgerSnapshot,
): Promise<ImportPreview> {
  const parsed = ParsedDocumentImportSchema.parse(input);
  const context = ImportContextSchema.parse(inputContext);
  const importBatchId = `import:v1:${encodeURIComponent(context.accountId)}:${parsed.documentSha256}`;
  let rows: PreviewRow[] = parsed.drafts.map((draft) => reviewDraft(draft, context, importBatchId));
  const issues = [...parsed.issues];
  const synthetic =
    parsed.dataMode === 'MOCK' &&
    parsed.parserId === 'synthetic-dime' &&
    parsed.parserVersion === 'synthetic-dime-v1' &&
    !parsed.formatVerified &&
    parsed.drafts.every((draft) => !draft.documentOrder);
  const confirmation =
    parsed.dataMode === 'DOCUMENT' &&
    parsed.parserId === 'dime-confirmation' &&
    parsed.parserVersion === 'dime-confirmation-v1' &&
    parsed.formatVerified &&
    parsed.drafts.every((draft) => !!draft.documentOrder);
  if (!synthetic && !confirmation) issues.push('UNVERIFIED_DIME_FORMAT');
  if (rows.length === 0) issues.push('EMPTY_DOCUMENT');
  if (new Set(rows.map((row) => row.draft.sourceRow)).size !== rows.length)
    issues.push('DUPLICATE_SOURCE_ROW');
  if (rows.some((row) => row.trade === null)) issues.push('INCOMPLETE_BATCH');
  const candidates: Trade[] = rows.flatMap((row) => (row.trade ? [row.trade] : []));
  if (issues.length === 0) {
    try {
      assertCompatibleTradeEvidence(snapshot.trades, candidates);
      const merged = mergeLedger(snapshot.trades, candidates, snapshot.aliases);
      rebuildPositions([...snapshot.trades, ...merged.added]);
      const addedIds = new Set(merged.added.map((trade) => trade.id));
      rows = rows.map((row) => ({
        ...row,
        status: row.trade && addedIds.has(row.trade.id) ? 'READY' : 'DUPLICATE',
      }));
      const original = snapshot.batches.find(
        (batch) => batch.documentSha256 === parsed.documentSha256 || batch.id === importBatchId,
      );
      if (original) {
        const sources = snapshot.aliases.filter((source) => source.importBatchId === original.id);
        const byRow = new Map(sources.map((source) => [source.sourceRow, source]));
        if (
          original.documentSha256 !== parsed.documentSha256 ||
          original.parserVersion !== parsed.parserVersion ||
          sources.length !== rows.length ||
          candidates.some((trade) => {
            const source = byRow.get(trade.sourceRow);
            return (
              !source ||
              source.id !== trade.id ||
              source.externalRef !== trade.externalRef ||
              source.fingerprint !== tradeFingerprint(trade)
            );
          })
        )
          issues.push('DOCUMENT_REPLAY_CONFLICT');
      }
    } catch (error) {
      issues.push(error instanceof LedgerConflictError ? 'LEDGER_CONFLICT' : 'LEDGER_INVALID');
    }
  }
  const canConfirm = issues.length === 0;
  // Bind explicit review to this exact extraction, mapping, candidates and ledger revision.
  // This digest is a change detector, never an authentication/authorization token.
  const reviewDigest = await documentSha256(
    new TextEncoder().encode(
      JSON.stringify({ parsed, context, ledgerRevision: snapshot.revision, rows }),
    ),
  );
  return ImportPreviewSchema.parse({
    status: !canConfirm
      ? 'NEEDS_REVIEW'
      : rows.every((row) => row.status === 'DUPLICATE')
        ? 'DUPLICATE'
        : 'READY',
    canConfirm,
    dataMode: parsed.dataMode,
    documentSha256: parsed.documentSha256,
    parserVersion: parsed.parserVersion,
    importBatchId,
    ledgerRevision: snapshot.revision,
    reviewDigest,
    issues: [...new Set(issues)],
    rows,
  });
}
