import { describe, expect, it } from 'vitest';
import type { PreviewImportInput } from '@portfolio/contracts';
import {
  rebuildPositions,
  tradeFingerprint,
  LedgerRevisionConflictError,
  type ImportBatch,
  type LedgerSnapshot,
  type Trade,
  type TransactionRepository,
} from '@portfolio/domain';
import { extractPdf } from '@portfolio/importers/pdf';
import {
  extractedDocument,
  syntheticContext,
  syntheticFill,
  syntheticLines,
  syntheticPdf,
} from '../../../../../tests/fixtures/synthetic-dime.js';
import { previewImport } from './preview-import.js';
import { confirmImport } from './confirm-import.js';
import { confirmationPdf } from '../../../../../tests/fixtures/dime-confirmation.js';

class MemoryRepository implements TransactionRepository {
  snapshot: LedgerSnapshot = { revision: 0, trades: [], batches: [], aliases: [] };
  async readLedger() {
    return structuredClone(this.snapshot);
  }
  async appendBatch(
    batch: ImportBatch,
    trades: readonly Trade[],
    revision: number,
    sources: readonly Trade[],
  ) {
    if (revision !== this.snapshot.revision) throw new LedgerRevisionConflictError();
    this.snapshot = {
      revision: revision + 1,
      trades: [...this.snapshot.trades, ...trades],
      batches: [...this.snapshot.batches, batch],
      aliases: [
        ...this.snapshot.aliases,
        ...sources.map((trade) => ({
          id: trade.id,
          accountId: trade.accountId,
          externalRef: trade.externalRef,
          importBatchId: trade.importBatchId,
          sourceRow: trade.sourceRow,
          fingerprint: tradeFingerprint(trade),
        })),
      ],
    };
  }
}
const request = (rows = [syntheticFill()]): PreviewImportInput => ({
  document: extractedDocument(syntheticLines(rows)),
  parserId: 'synthetic-dime' as const,
  context: syntheticContext,
});
const confirm = (req: ReturnType<typeof request>, digest: string, sourceRows = [1]) => ({
  request: req,
  reviewed: true,
  reviewDigest: digest,
  reviewedSourceRows: sourceRows,
  confirmedAt: '2026-01-08T15:00:00Z',
});

describe('internal import use cases', () => {
  it('confirms actual-template MOCK orders without execution time, sequence or derived gross', async () => {
    const repository = new MemoryRepository();
    const req: PreviewImportInput = {
      document: await extractPdf(confirmationPdf(), 'application/pdf'),
      parserId: 'dime-confirmation',
      context: syntheticContext,
    };
    const preview = await previewImport(repository, req);
    expect(preview).toMatchObject({ canConfirm: true, dataMode: 'DOCUMENT' });
    expect(await confirmImport(repository, confirm(req, preview.reviewDigest))).toMatchObject({
      inserted: 1,
    });
    expect(repository.snapshot.trades[0]).toMatchObject({
      status: 'CONFIRMED',
      precision: 'DOCUMENT_DATE',
      executedAt: null,
      sequence: null,
      executionPrice: null,
      grossAmount: '30.93',
      netAmount: '31.53',
    });
    expect(rebuildPositions(repository.snapshot.trades)).toMatchObject([
      { quantity: '0.1234567', costBasis: '31.53', calculationStatus: 'AVAILABLE' },
    ]);
    expect(
      await confirmImport(
        repository,
        confirm(req, (await previewImport(repository, req)).reviewDigest),
      ),
    ).toMatchObject({ inserted: 0, duplicates: 1 });
  }, 30_000);
  it('proves PDF text → preview → reviewed M1 trade without persisting PDF text', async () => {
    const repository = new MemoryRepository();
    const req = request();
    req.document = await extractPdf(
      syntheticPdf(syntheticLines([syntheticFill()])),
      'application/pdf',
    );
    const preview = await previewImport(repository, req);
    expect(repository.snapshot.trades).toEqual([]);
    expect(await confirmImport(repository, confirm(req, preview.reviewDigest))).toMatchObject({
      inserted: 1,
      duplicates: 0,
      dataMode: 'MOCK',
    });
    expect(rebuildPositions(repository.snapshot.trades)).toMatchObject([
      { quantity: '2', costBasis: '21.2', realizedPL: '0' },
    ]);
    expect(JSON.stringify(repository.snapshot)).not.toContain('YUJEEN_SYNTHETIC_DIME_V1');
  });

  it('reuploads a document after reload without adding shares or source aliases again', async () => {
    const repository = new MemoryRepository();
    const req = request();
    await confirmImport(
      repository,
      confirm(req, (await previewImport(repository, req)).reviewDigest),
    );
    const reloaded = new MemoryRepository();
    reloaded.snapshot = structuredClone(repository.snapshot);
    expect(
      await confirmImport(
        reloaded,
        confirm(req, (await previewImport(reloaded, req)).reviewDigest),
      ),
    ).toMatchObject({ inserted: 0, duplicates: 1 });
    expect(reloaded.snapshot.revision).toBe(1);
    expect(reloaded.snapshot.trades).toHaveLength(1);
    expect(reloaded.snapshot.aliases).toHaveLength(1);
  });

  it('requires explicit review of every source row, never a silent partial batch', async () => {
    const repository = new MemoryRepository();
    const req = request([
      syntheticFill(),
      syntheticFill({ sequence: '2', externalRef: 'mock-fill-2' }),
    ]);
    const preview = await previewImport(repository, req);
    await expect(
      confirmImport(repository, confirm(req, preview.reviewDigest, [1])),
    ).rejects.toThrow('REVIEW_ROWS_REQUIRED');
    await expect(
      confirmImport(repository, { ...confirm(req, preview.reviewDigest, [1, 2]), reviewed: false }),
    ).rejects.toThrow();
    expect(repository.snapshot).toMatchObject({ revision: 0, trades: [], batches: [] });
  });

  it('rechecks source text and mapping against the approved preview', async () => {
    const repository = new MemoryRepository();
    const req = request();
    const preview = await previewImport(repository, req);
    const changed = request([syntheticFill({ executionPrice: '11' })]);
    await expect(confirmImport(repository, confirm(changed, preview.reviewDigest))).rejects.toThrow(
      'PREVIEW_CHANGED',
    );
    await expect(
      confirmImport(
        repository,
        confirm(
          { ...req, context: { ...syntheticContext, accountId: 'other' } },
          preview.reviewDigest,
        ),
      ),
    ).rejects.toThrow('PREVIEW_CHANGED');
    expect(repository.snapshot.trades).toEqual([]);
  });

  it('requires a new review after another writer changes the ledger revision', async () => {
    const repository = new MemoryRepository();
    const req = request();
    const preview = await previewImport(repository, req);
    repository.snapshot = { ...repository.snapshot, revision: 1 };
    await expect(confirmImport(repository, confirm(req, preview.reviewDigest))).rejects.toThrow(
      'PREVIEW_CHANGED',
    );
    expect(repository.snapshot.trades).toEqual([]);
  });

  it('pins the reviewed revision even when another write happens after confirmation revalidation', async () => {
    const stored = new MemoryRepository();
    const req = request();
    const preview = await previewImport(stored, req);
    let firstRead = true;
    const interleaved: TransactionRepository = {
      async readLedger() {
        const snapshot = await stored.readLedger();
        if (firstRead) {
          firstRead = false;
          stored.snapshot = { ...stored.snapshot, revision: 1 };
        }
        return snapshot;
      },
      appendBatch: (batch, trades, revision, sources) =>
        stored.appendBatch(batch, trades, revision, sources),
    };
    await expect(confirmImport(interleaved, confirm(req, preview.reviewDigest))).rejects.toThrow(
      'PREVIEW_CHANGED',
    );
    expect(stored.snapshot).toMatchObject({ revision: 1, trades: [], batches: [], aliases: [] });
  });

  it('does not retry an append conflict against a ledger the user has never reviewed', async () => {
    const stored = new MemoryRepository();
    const req = request();
    const preview = await previewImport(stored, req);
    let firstAppend = true;
    const interleaved: TransactionRepository = {
      readLedger: () => stored.readLedger(),
      async appendBatch(batch, trades, revision, sources) {
        if (firstAppend) {
          firstAppend = false;
          stored.snapshot = { ...stored.snapshot, revision: 1 };
          throw new LedgerRevisionConflictError();
        }
        await stored.appendBatch(batch, trades, revision, sources);
      },
    };
    await expect(confirmImport(interleaved, confirm(req, preview.reviewDigest))).rejects.toThrow(
      'PREVIEW_CHANGED',
    );
    expect(stored.snapshot).toMatchObject({ revision: 1, trades: [], batches: [], aliases: [] });
  });

  it('blocks unknown real layout, missing fields and pending/cancelled rows even with review flags', async () => {
    const repository = new MemoryRepository();
    const real = {
      ...request(),
      parserId: 'dime-unverified',
      document: extractedDocument(['Dime Confirmation Note']),
    };
    const preview = await previewImport(repository, real);
    expect(preview.status).toBe('NEEDS_REVIEW');
    await expect(
      confirmImport(repository, { ...confirm(request(), preview.reviewDigest), request: real }),
    ).rejects.toThrow('NEEDS_REVIEW');
    for (const patch of [
      { executionPrice: null },
      { sequence: null },
      { tradeStatus: 'PENDING' },
      { tradeStatus: 'CANCELLED' },
    ]) {
      const req = request([syntheticFill(patch)]);
      await expect(
        confirmImport(
          repository,
          confirm(req, (await previewImport(repository, req)).reviewDigest),
        ),
      ).rejects.toThrow('NEEDS_REVIEW');
    }
    expect(repository.snapshot).toMatchObject({
      revision: 0,
      trades: [],
      batches: [],
      aliases: [],
    });
  });

  it('does not write when the confirmation time is invalid', async () => {
    const repository = new MemoryRepository();
    const req = request();
    const preview = await previewImport(repository, req);
    await expect(
      confirmImport(repository, {
        ...confirm(req, preview.reviewDigest),
        confirmedAt: '2026-02-30T15:00:00Z',
      }),
    ).rejects.toThrow();
    expect(repository.snapshot.trades).toEqual([]);
  });
});
