import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { syntheticPdf } from '../../../tests/fixtures/synthetic-dime.js';
import {
  encryptedMockPdfBase64,
  mockPdfPassword,
} from '../../../tests/fixtures/encrypted-mock-pdf.js';
import { extractPdf } from './pdf-extractor.js';
import { validateDocumentBytes } from './extraction.js';

describe('bounded local PDF extraction', () => {
  it('handles encrypted PDF password retry without leaking or saving the password', async () => {
    const bytes = new Uint8Array(Buffer.from(encryptedMockPdfBase64, 'base64'));
    await expect(extractPdf(bytes, 'application/pdf')).rejects.toMatchObject({
      code: 'PASSWORD_REQUIRED',
    });
    await expect(
      extractPdf(bytes, 'application/pdf', { password: 'incorrect-synthetic-password' }),
    ).rejects.toMatchObject({ code: 'INCORRECT_PASSWORD' });
    const result = await extractPdf(bytes, 'application/pdf', { password: mockPdfPassword });
    expect(result.pages[0]?.lines[0]?.text).toBe('MOCK encrypted document');
    expect(result.documentSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(JSON.stringify(result)).not.toContain(mockPdfPassword);
  }, 30_000);

  it('does not start decoding an already-cancelled document', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      extractPdf(syntheticPdf(), 'application/pdf', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });
  it('extracts text and hashes original bytes without consuming or mutating the source', async () => {
    const bytes = syntheticPdf(['MOCK document', 'Execution Price: 10.25']);
    const before = bytes.slice();
    const doc = await extractPdf(bytes, 'application/pdf');
    expect(doc.documentSha256).toBe(createHash('sha256').update(before).digest('hex'));
    expect(doc.pages[0]?.lines.map((line) => line.text)).toEqual([
      'MOCK document',
      'Execution Price: 10.25',
    ]);
    expect(doc.pages[0]?.lines[1]).toMatchObject({ line: 2, confidence: 1 });
    expect(doc.method).toBe('PDF_TEXT');
    expect(bytes).toEqual(before);
    expect(await extractPdf(bytes, 'application/pdf')).toEqual(doc);
  });

  it('requires OCR/review for an image-only or empty text page instead of inventing data', async () => {
    const doc = await extractPdf(syntheticPdf([]), 'application/pdf');
    expect(doc.issues).toContain('OCR_REQUIRED');
    expect(doc.pages[0]?.lines).toEqual([]);
  });

  it('rejects a corrupt PDF with a safe error', async () => {
    await expect(
      extractPdf(new TextEncoder().encode('%PDF-1.7\nsecret-content'), 'application/pdf'),
    ).rejects.toMatchObject({ code: 'INVALID_PDF', message: 'INVALID_PDF' });
  });

  it.each(['image/png', 'text/plain', 'application/octet-stream'])(
    'rejects unsupported type %s before parsing',
    (type) => {
      expect(() => validateDocumentBytes(syntheticPdf(), type)).toThrow('UNSUPPORTED_TYPE');
    },
  );
  it('rejects spoofed content, empty and oversized files before hashing or PDF decoding', () => {
    expect(() =>
      validateDocumentBytes(new TextEncoder().encode('private text'), 'application/pdf'),
    ).toThrow('INVALID_SIGNATURE');
    expect(() => validateDocumentBytes(new Uint8Array(), 'application/pdf')).toThrow(
      'FILE_SIZE_LIMIT',
    );
    expect(() =>
      validateDocumentBytes(new Uint8Array(10 * 1024 * 1024 + 1), 'application/pdf'),
    ).toThrow('FILE_SIZE_LIMIT');
  });
});
