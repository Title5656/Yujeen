import { ConfirmImportInputSchema } from '@portfolio/contracts';
import { LedgerRevisionConflictError, type TransactionRepository } from '@portfolio/domain';
import { recordConfirmedTrades } from '../transactions/record-confirmed-trades.js';
import { previewImport } from './preview-import.js';

/** Reparse + validate + re-read; review digests never substitute for authentication. */
export async function confirmImport(repository: TransactionRepository, input: unknown) {
  const command = ConfirmImportInputSchema.parse(input);
  const preview = await previewImport(repository, command.request);
  if (!preview.canConfirm) throw new Error('NEEDS_REVIEW');
  if (preview.reviewDigest !== command.reviewDigest) throw new Error('PREVIEW_CHANGED');
  const approvedRows = new Set(command.reviewedSourceRows);
  if (
    approvedRows.size !== command.reviewedSourceRows.length ||
    approvedRows.size !== preview.rows.length ||
    preview.rows.some((row) => !approvedRows.has(row.draft.sourceRow))
  )
    throw new Error('REVIEW_ROWS_REQUIRED');
  try {
    const result = await recordConfirmedTrades(
      repository,
      {
        batch: {
          id: preview.importBatchId,
          accountId: command.request.context.accountId,
          documentSha256: preview.documentSha256,
          parserVersion: preview.parserVersion,
          confirmedAt: command.confirmedAt,
        },
        trades: preview.rows.map((row) => row.trade),
      },
      preview.ledgerRevision,
    );
    return { ...result, dataMode: preview.dataMode, documentSha256: preview.documentSha256 };
  } catch (error) {
    if (error instanceof LedgerRevisionConflictError)
      throw new Error('PREVIEW_CHANGED', { cause: error });
    throw error;
  }
}
