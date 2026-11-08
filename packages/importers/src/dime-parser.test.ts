import { describe, expect, it } from 'vitest';
import { DimeParser } from './dime-parser.js';
import { SyntheticDimeParser } from './synthetic-parser.js';
import { syntheticFill, syntheticLines } from '../../../tests/fixtures/synthetic-dime.js';

export const extracted = (lines: readonly string[], hash = 'a'.repeat(64)) => ({
  documentSha256: hash,
  method: 'PDF_TEXT' as const,
  issues: [],
  pages: [{ page: 1, lines: lines.map((text, i) => ({ line: i + 1, text, confidence: 1 })) }],
});

describe('Dime format verification boundary', () => {
  it('does not infer actual Dime fields or a filled trade from unverified text', () => {
    const result = new DimeParser().parse(extracted(['Dime Confirmation Note', 'BUY MOCK 10 USD']));
    expect(result).toMatchObject({
      dataMode: 'DOCUMENT',
      formatVerified: false,
      issues: ['UNVERIFIED_DIME_FORMAT'],
      drafts: [],
    });
    expect(JSON.stringify(result)).not.toContain('BUY MOCK');
  });

  it('keeps explicit synthetic fills and decimal strings with page/line evidence', () => {
    const result = new SyntheticDimeParser().parse(
      extracted(
        syntheticLines([
          syntheticFill({ quantity: '0.123456789012', executionPrice: '10.25' }),
          syntheticFill({ sequence: '2', externalRef: 'mock-fill-2' }),
        ]),
      ),
    );
    expect(result).toMatchObject({
      dataMode: 'MOCK',
      formatVerified: false,
      parserVersion: 'synthetic-dime-v1',
      drafts: [
        {
          sourceRow: 1,
          fields: { quantity: '0.123456789012', executionPrice: '10.25', sequence: '1' },
          evidence: { quantity: { page: 1, line: 2, confidence: 1 } },
        },
        { sourceRow: 2, fields: { sequence: '2', externalRef: 'mock-fill-2' } },
      ],
    });
  });

  it('preserves absent execution, sequence and fee/tax as null rather than defaults', () => {
    const row = syntheticFill();
    delete (row as Record<string, unknown>)['executedAt'];
    delete (row as Record<string, unknown>)['sequence'];
    delete (row as Record<string, unknown>)['fee'];
    delete (row as Record<string, unknown>)['tax'];
    const result = new SyntheticDimeParser().parse(extracted(syntheticLines([row])));
    expect(result.drafts[0]?.fields).toMatchObject({
      executedAt: null,
      sequence: null,
      fee: null,
      tax: null,
    });
  });

  it('rejects untagged input and malformed synthetic rows without leaking raw text', () => {
    expect(() => new SyntheticDimeParser().parse(extracted(['Dime document']))).toThrow(
      'SYNTHETIC_FORMAT_REQUIRED',
    );
    expect(() =>
      new SyntheticDimeParser().parse(extracted(['YUJEEN_SYNTHETIC_DIME_V1', '{private text'])),
    ).toThrow('INVALID_SYNTHETIC_ROW');
  });

  it('bounds the row count instead of truncating a document silently', () => {
    expect(() =>
      new SyntheticDimeParser().parse(
        extracted(syntheticLines(Array.from({ length: 101 }, () => syntheticFill()))),
      ),
    ).toThrow('ROW_LIMIT');
  });
});
