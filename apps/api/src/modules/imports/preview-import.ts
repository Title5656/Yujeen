import { PreviewImportInputSchema, type ImportPreview } from '@portfolio/contracts';
import type { TransactionRepository } from '@portfolio/domain';
import { buildImportPreview, DimeParser, SyntheticDimeParser } from '@portfolio/importers';

/** Internal only until an authenticated/authorized transport is implemented. */
export async function previewImport(
  repository: TransactionRepository,
  input: unknown,
): Promise<ImportPreview> {
  const request = PreviewImportInputSchema.parse(input);
  const parser =
    request.parserId === 'synthetic-dime' ? new SyntheticDimeParser() : new DimeParser();
  const parsed = parser.parse(request.document);
  const snapshot = await repository.readLedger(request.context.accountId);
  return buildImportPreview(parsed, request.context, snapshot);
}
