import { ConfirmedTradeBatchSchema } from '@portfolio/contracts';
import {
  LedgerConflictError,
  LedgerRevisionConflictError,
  mergeLedger,
  rebuildPositions,
  tradeFingerprint,
  validateTrade,
  type TransactionRepository,
} from '@portfolio/domain';

export async function recordConfirmedTrades(
  repository: TransactionRepository,
  input: unknown,
): Promise<{ inserted: number; duplicates: number }> {
  const parsed = ConfirmedTradeBatchSchema.parse(input);
  const { batch } = parsed;
  const trades = parsed.trades.map(validateTrade);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snapshot = await repository.readLedger(batch.accountId);
    const merged = mergeLedger(snapshot.trades, trades, snapshot.aliases);
    // Financial correctness is checked before any persistence, including backdated
    // imports. A revision guard prevents another append invalidating that check.
    rebuildPositions([...snapshot.trades, ...merged.added]);

    const sameId = snapshot.batches.find((existing) => existing.id === batch.id);
    const sameDocument = snapshot.batches.find(
      (existing) => existing.documentSha256 === batch.documentSha256,
    );
    if (sameId !== undefined || sameDocument !== undefined) {
      if (
        (sameId !== undefined && sameId.documentSha256 !== batch.documentSha256) ||
        merged.added.length > 0
      ) {
        throw new LedgerConflictError('A confirmed document cannot be changed');
      }
      const original = sameDocument ?? sameId;
      const sources = snapshot.aliases.filter((source) => source.importBatchId === original?.id);
      const incomingRows = new Set(trades.map((trade) => trade.sourceRow));
      if (
        original?.parserVersion !== batch.parserVersion ||
        incomingRows.size !== sources.length ||
        trades.some(
          (trade) =>
            !sources.some(
              (source) =>
                source.sourceRow === trade.sourceRow &&
                source.id === trade.id &&
                source.externalRef === trade.externalRef &&
                source.fingerprint === tradeFingerprint(trade),
            ),
        )
      ) {
        // Same-file replay cannot acknowledge newly learned aliases without a
        // write. M1 requires stable source identities; corrections need review.
        throw new LedgerConflictError(
          'A document replay must preserve every confirmed source identity',
        );
      }
      return { inserted: 0, duplicates: merged.duplicates };
    }
    try {
      await repository.appendBatch(batch, merged.added, snapshot.revision, trades);
      return { inserted: merged.added.length, duplicates: merged.duplicates };
    } catch (error) {
      if (!(error instanceof LedgerRevisionConflictError) || attempt === 2) throw error;
    }
  }
  throw new LedgerRevisionConflictError();
}
