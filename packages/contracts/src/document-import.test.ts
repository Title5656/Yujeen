import { describe, expect, it } from 'vitest';
import { ExtractedDocumentSchema, PreviewImportInputSchema } from './index.js';
import { extractedDocument, syntheticContext } from '../../../tests/fixtures/synthetic-dime.js';

describe('untrusted extraction boundary', () => {
  it.each([
    { documentSha256: 'not-a-hash' },
    { pages: [] },
    { pages: Array.from({ length: 21 }, (_, i) => ({ page: i + 1, lines: [] })) },
    { pages: [{ page: 1, lines: [{ line: 1, text: 'x'.repeat(500_001), confidence: 1 }] }] },
    { pages: [{ page: 1, lines: [{ line: 1, text: 'MOCK', confidence: -0.1 }] }] },
    { password: 'synthetic-secret-not-accepted' },
  ])('rejects invalid, unbounded or password-bearing extraction %#', (patch) => {
    expect(
      ExtractedDocumentSchema.safeParse({ ...extractedDocument(['MOCK']), ...patch }).success,
    ).toBe(false);
  });

  it('rejects aggregate text size even when each page is below the individual limit', () => {
    expect(
      ExtractedDocumentSchema.safeParse({
        ...extractedDocument([]),
        pages: [1, 2].map((page) => ({
          page,
          lines: [{ line: 1, text: 'x'.repeat(250_001), confidence: 1 }],
        })),
      }).success,
    ).toBe(false);
  });

  it('rejects repeated source coordinates and a client-provided parser or arbitrary endpoint', () => {
    const doc = extractedDocument(['MOCK']);
    expect(
      ExtractedDocumentSchema.safeParse({ ...doc, pages: [...doc.pages, ...doc.pages] }).success,
    ).toBe(false);
    expect(
      PreviewImportInputSchema.safeParse({
        document: doc,
        context: syntheticContext,
        parserId: 'https://example.com/parser',
      }).success,
    ).toBe(false);
    expect(
      PreviewImportInputSchema.safeParse({
        document: doc,
        context: syntheticContext,
        parserId: 'dime-unverified',
        endpoint: 'http://localhost',
      }).success,
    ).toBe(false);
  });
});
