import { describe, expect, it } from 'vitest';
import { confirmationFixture } from '../../../tests/fixtures/dime-confirmation.js';
import { syntheticContext } from '../../../tests/fixtures/synthetic-dime.js';
import { DimeParser } from './dime-parser.js';
import { buildImportPreview } from './preview.js';
const empty = { revision: 0, trades: [], batches: [], aliases: [] };

describe('documentary import safety regressions', () => {
  it('does not silently skip a row with both side and currency unreadable', async () => {
    const parsed = new DimeParser().parse(
      confirmationFixture([{}, { side: null, currency: null }]),
    );
    expect(parsed.issues).toContain('UNREADABLE_TABLE_ROWS');
    expect((await buildImportPreview(parsed, syntheticContext, empty)).canConfirm).toBe(false);
  });
  it.each(['date', 'security'])(
    'requires review when the same order ID changes %s',
    async (change) => {
      const first = await buildImportPreview(
        new DimeParser().parse(confirmationFixture()),
        syntheticContext,
        empty,
      );
      expect(first.canConfirm).toBe(true);
      const doc = confirmationFixture();
      doc.documentSha256 = 'e'.repeat(64);
      if (change === 'date') {
        for (const item of doc.pages[0]!.items)
          if (item.text === '06/01/2026') item.text = '09/01/2026';
        for (const line of doc.pages[0]!.lines)
          if (line.text === '06/01/2026') line.text = '09/01/2026';
      }
      const context =
        change === 'security'
          ? {
              ...syntheticContext,
              securities: [{ ...syntheticContext.securities[0]!, securityId: 'other-security' }],
            }
          : syntheticContext;
      const second = await buildImportPreview(new DimeParser().parse(doc), context, {
        ...empty,
        revision: 1,
        trades: [first.rows[0]!.trade!],
      });
      expect(second.issues).toContain('LEDGER_CONFLICT');
      expect(second.canConfirm).toBe(false);
    },
  );
});
