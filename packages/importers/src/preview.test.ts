import { describe, expect, it } from 'vitest';
import { rebuildPositions, tradeFingerprint, type LedgerSnapshot } from '@portfolio/domain';
import {
  extractedDocument,
  syntheticContext,
  syntheticFill,
  syntheticLines,
} from '../../../tests/fixtures/synthetic-dime.js';
import { SyntheticDimeParser } from './synthetic-parser.js';
import { buildImportPreview } from './preview.js';

const empty: LedgerSnapshot = { revision: 0, trades: [], batches: [], aliases: [] };
const parse = (rows: Record<string, unknown>[], hash = 'a'.repeat(64)) =>
  new SyntheticDimeParser().parse(extractedDocument(syntheticLines(rows), hash));

describe('review drafts before the M1 ledger', () => {
  it('maps confirmed fill fields to the exact M1 model and hand-calculated cost', async () => {
    const result = await buildImportPreview(parse([syntheticFill()]), syntheticContext, empty);
    expect(result).toMatchObject({
      status: 'READY',
      canConfirm: true,
      dataMode: 'MOCK',
      rows: [
        {
          status: 'READY',
          issues: [],
          trade: {
            broker: 'DIME',
            accountId: 'mock-account',
            securityId: 'mock-security',
            market: 'US',
            currency: 'USD',
            side: 'BUY',
            status: 'FILLED',
            quantity: '2',
            executionPrice: '10',
            fee: '1',
            tax: '0.2',
            feeCurrency: 'USD',
            executedAt: '2026-01-05T15:00:00.000Z',
            tradeDate: '2026-01-05',
            sequence: 1,
            externalRef: 'mock-fill-1',
            sourceRow: 1,
          },
        },
      ],
    });
    const trades = result.rows.flatMap((row) => (row.trade ? [row.trade] : []));
    expect(rebuildPositions(trades)).toMatchObject([
      { quantity: '2', costBasis: '21.2', realizedPL: '0' },
    ]);
    expect(result.reviewDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(empty.trades).toEqual([]);
  });

  it.each([
    'quantity',
    'executionPrice',
    'fee',
    'tax',
    'executedAt',
    'sequence',
    'currency',
    'feeCurrency',
    'externalRef',
    'referenceKind',
    'side',
    'tradeStatus',
  ])('requires review when %s is missing, including explicit zero fees', async (field) => {
    const row = syntheticFill();
    delete (row as Record<string, unknown>)[field];
    const result = await buildImportPreview(parse([row]), syntheticContext, empty);
    expect(result.canConfirm).toBe(false);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.rows[0]?.issues).toContain(`MISSING:${field}`);
    expect(result.rows[0]?.trade).toBeNull();
  });

  it.each([
    { executedAt: '2026-01-05' },
    { executedAt: '2026-01-05T15:00:00' },
    { executedAt: '2026-02-30T15:00:00Z' },
    { sequence: '1.2' },
    { sequence: '9007199254740992' },
    { quantity: '-1' },
    { quantity: '1e2' },
    { quantity: '0' },
    { executionPrice: '0' },
    { fee: '-1' },
    { tax: 'unknown' },
    { feeCurrency: 'THB' },
    { currency: 'THB' },
    { referenceKind: 'ORDER' },
  ])('does not normalize away invalid financial or execution evidence %#', async (patch) => {
    const result = await buildImportPreview(parse([syntheticFill(patch)]), syntheticContext, empty);
    expect(result.canConfirm).toBe(false);
    expect(result.rows[0]?.status).toBe('NEEDS_REVIEW');
  });

  it.each(['PENDING', 'CANCELLED', 'PARTIALLY_FILLED', 'UNKNOWN'])(
    'does not promote %s to FILLED',
    async (tradeStatus) => {
      const result = await buildImportPreview(
        parse([syntheticFill({ tradeStatus })]),
        syntheticContext,
        empty,
      );
      expect(result.canConfirm).toBe(false);
      expect(result.rows[0]).toMatchObject({ status: 'NOT_FILLED', trade: null });
    },
  );

  it('blocks low-confidence evidence and unknown or ambiguous security mappings', async () => {
    const parsed = parse([syntheticFill()]);
    const draft = parsed.drafts[0]!;
    draft.evidence.quantity!.confidence = 0.6;
    expect((await buildImportPreview(parsed, syntheticContext, empty)).rows[0]?.issues).toContain(
      'LOW_CONFIDENCE:quantity',
    );
    const unresolved = await buildImportPreview(
      parse([syntheticFill()]),
      { ...syntheticContext, securities: [] },
      empty,
    );
    expect(unresolved.rows[0]?.issues).toContain('SECURITY_MAPPING_REQUIRED');
    expect(
      (
        await buildImportPreview(
          parse([syntheticFill()]),
          {
            ...syntheticContext,
            securities: [
              ...syntheticContext.securities,
              { ...syntheticContext.securities[0]!, securityId: 'other' },
            ],
          },
          empty,
        )
      ).canConfirm,
    ).toBe(false);
  });

  it('keeps source identities stable across reload and separates identical genuine fills by documented sequence', async () => {
    const parsed = parse([
      syntheticFill(),
      syntheticFill({ sequence: '2', externalRef: 'mock-fill-2' }),
    ]);
    const one = await buildImportPreview(parsed, syntheticContext, empty);
    expect(one).toEqual(await buildImportPreview(structuredClone(parsed), syntheticContext, empty));
    expect(one.rows.map((row) => row.trade?.sequence)).toEqual([1, 2]);
    expect(new Set(one.rows.map((row) => row.trade?.id)).size).toBe(2);
    expect(rebuildPositions(one.rows.flatMap((r) => (r.trade ? [r.trade] : [])))).toMatchObject([
      { quantity: '4', costBasis: '42.4' },
    ]);
    const ambiguous = await buildImportPreview(
      parse([syntheticFill(), syntheticFill({ externalRef: 'mock-fill-2' })]),
      syntheticContext,
      empty,
    );
    expect(ambiguous.canConfirm).toBe(false);
    expect(ambiguous.issues).toContain('LEDGER_CONFLICT');
  });

  it('detects a cross-file duplicate and conflicts with changed economics', async () => {
    const first = await buildImportPreview(parse([syntheticFill()]), syntheticContext, empty);
    const trade = first.rows[0]!.trade!;
    const snapshot = { ...empty, revision: 1, trades: [trade] };
    const duplicate = await buildImportPreview(
      parse([syntheticFill()], 'b'.repeat(64)),
      syntheticContext,
      snapshot,
    );
    expect(duplicate).toMatchObject({
      status: 'DUPLICATE',
      canConfirm: true,
      rows: [{ status: 'DUPLICATE' }],
    });
    expect(
      (
        await buildImportPreview(
          parse([syntheticFill({ executionPrice: '11' })], 'c'.repeat(64)),
          syntheticContext,
          snapshot,
        )
      ).issues,
    ).toContain('LEDGER_CONFLICT');
  });

  it('requires exact source identity for same-file replay, not just an equal fingerprint', async () => {
    const first = await buildImportPreview(parse([syntheticFill()]), syntheticContext, empty);
    const trade = first.rows[0]!.trade!;
    const snapshot = {
      ...empty,
      revision: 1,
      trades: [trade],
      batches: [
        {
          id: first.importBatchId,
          accountId: 'mock-account',
          documentSha256: 'a'.repeat(64),
          parserVersion: 'synthetic-dime-v1',
          confirmedAt: '2026-01-06T12:00:00Z',
        },
      ],
      aliases: [{ ...trade, fingerprint: tradeFingerprint(trade) }],
    };
    expect(
      (await buildImportPreview(parse([syntheticFill()]), syntheticContext, snapshot)).status,
    ).toBe('DUPLICATE');
    snapshot.aliases[0]!.id = 'different-source-id';
    expect(
      (await buildImportPreview(parse([syntheticFill()]), syntheticContext, snapshot)).issues,
    ).toContain('DOCUMENT_REPLAY_CONFLICT');
  });

  it('checks multiple buys, a partial sale and fees using the M1 compressed FIFO policy', async () => {
    const result = await buildImportPreview(
      parse([
        syntheticFill(),
        syntheticFill({
          executedAt: '2026-01-06T15:00:00Z',
          sequence: '2',
          quantity: '1',
          executionPrice: '20',
          fee: '0.4',
          tax: '0',
          externalRef: 'mock-buy-2',
        }),
        syntheticFill({
          side: 'SELL',
          executedAt: '2026-01-07T15:00:00Z',
          sequence: '3',
          quantity: '2.5',
          executionPrice: '30',
          fee: '0.5',
          tax: '0.1',
          externalRef: 'mock-sell-1',
        }),
      ]),
      syntheticContext,
      empty,
    );
    expect(result.canConfirm).toBe(true);
    expect(rebuildPositions(result.rows.flatMap((r) => (r.trade ? [r.trade] : [])))).toMatchObject([
      { quantity: '0.5', costBasis: '10.2', realizedPL: '43' },
    ]);
  });

  it('does not silently filter one invalid row out of an otherwise valid batch', async () => {
    const result = await buildImportPreview(
      parse([syntheticFill(), syntheticFill({ sequence: null })]),
      syntheticContext,
      empty,
    );
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.canConfirm).toBe(false);
  });

  it('compresses multiple buys on the same day without rounding the daily cost', async () => {
    const result = await buildImportPreview(
      parse([
        syntheticFill({ quantity: '100', executionPrice: '10', fee: '0', tax: '0' }),
        syntheticFill({
          sequence: '2',
          quantity: '50',
          executionPrice: '12',
          fee: '0',
          tax: '0',
          externalRef: 'mock-fill-2',
        }),
        syntheticFill({
          executedAt: '2026-01-06T15:00:00Z',
          sequence: '3',
          quantity: '30',
          executionPrice: '15',
          fee: '0',
          tax: '0',
          externalRef: 'mock-fill-3',
        }),
        syntheticFill({
          side: 'SELL',
          executedAt: '2026-01-07T15:00:00Z',
          sequence: '4',
          quantity: '120',
          executionPrice: '20',
          fee: '0',
          tax: '0',
          externalRef: 'mock-fill-4',
        }),
      ]),
      syntheticContext,
      empty,
    );
    expect(result.canConfirm).toBe(true);
    expect(
      rebuildPositions(result.rows.flatMap((row) => (row.trade ? [row.trade] : []))),
    ).toMatchObject([{ quantity: '60', costBasis: '770', realizedPL: '1120' }]);
  });

  it('blocks overselling, ambiguous order and input with no drafts', async () => {
    expect(
      (await buildImportPreview(parse([syntheticFill({ side: 'SELL' })]), syntheticContext, empty))
        .issues,
    ).toContain('LEDGER_INVALID');
    expect((await buildImportPreview(parse([]), syntheticContext, empty)).canConfirm).toBe(false);
  });
});
