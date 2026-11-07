import type { ImportBatch, Trade, TradeAlias } from './trade.js';

export interface LedgerSnapshot {
  readonly revision: number;
  readonly trades: readonly Trade[];
  readonly batches: readonly ImportBatch[];
  readonly aliases: readonly TradeAlias[];
}

export interface TransactionRepository {
  readLedger(accountId: string): Promise<LedgerSnapshot>;
  appendBatch(
    batch: ImportBatch,
    trades: readonly Trade[],
    expectedRevision: number,
    sources: readonly Trade[],
  ): Promise<void>;
}

export class LedgerRevisionConflictError extends Error {
  constructor(message = 'Ledger revision changed; reload and revalidate before appending') {
    super(message);
    this.name = 'LedgerRevisionConflictError';
  }
}
