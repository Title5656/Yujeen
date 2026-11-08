import { describe, expect, it } from 'vitest';
import { confirmationFixture, confirmationPdf } from '../../../tests/fixtures/dime-confirmation.js';
import { DimeParser } from './dime-parser.js';
import { extractPdf } from './pdf-extractor.js';

describe('inspected Dime confirmation template with MOCK values', () => {
  it('extracts structured order amounts and preserves unknown execution fields', () => {
    const result = new DimeParser().parse(confirmationFixture());
    expect(result).toMatchObject({
      formatVerified: true,
      parserVersion: 'dime-confirmation-v1',
      drafts: [
        {
          fields: {
            symbol: 'MOCK',
            side: 'BUY',
            quantity: '0.1234567',
            fee: '0.50',
            tax: '0.10',
            currency: 'USD',
            executedAt: null,
            sequence: null,
            executionPrice: null,
            tradeStatus: null,
          },
          documentOrder: {
            orderId: '900001',
            effectiveDate: '2026-01-06',
            settlementDate: '2026-01-08',
            unitPrice: '250.50',
            grossAmount: '30.93',
            netAmount: '31.53',
            thbAmounts: { grossAmount: '1000.00', netAmount: '1018.00' },
          },
        },
      ],
    });
  });
  it('uses PDF coordinates when content order interleaves columns and the two currencies', async () => {
    const doc = await extractPdf(confirmationPdf(), 'application/pdf');
    expect(new DimeParser().parse(doc).drafts[0]).toMatchObject({
      fields: { fee: '0.50', tax: '0.10' },
      documentOrder: { grossAmount: '30.93', netAmount: '31.53' },
    });
  }, 30_000);
  it('keeps missing primary USD fee unknown instead of taking THB or zero', () => {
    const result = new DimeParser().parse(confirmationFixture([{ fee: null }]));
    expect(result.drafts[0]?.fields.fee).toBeNull();
  });
  it('handles several distinct orders and sell rows without inventing fill sequences', () => {
    const result = new DimeParser().parse(
      confirmationFixture([
        {},
        {
          side: 'SELL',
          quantity: '0.1',
          grossAmount: '25.00',
          fee: '0.50',
          tax: '0.10',
          netAmount: '24.40',
        },
      ]),
    );
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[1]).toMatchObject({
      sourceRow: 2,
      fields: { side: 'SELL', sequence: null },
      documentOrder: { orderId: '900002' },
    });
  });
  it('does not treat a title without table positions as a complete format', () => {
    const doc = confirmationFixture();
    const { items: _items, ...page } = doc.pages[0]!;
    void _items;
    expect(new DimeParser().parse({ ...doc, pages: [page] }).drafts).toEqual([]);
  });
});
