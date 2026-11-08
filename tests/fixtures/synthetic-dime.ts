/** Invented protocol for offline tests, never a representation of a real Dime layout. */
export const SYNTHETIC_HEADER = 'YUJEEN_SYNTHETIC_DIME_V1';
export const syntheticFill = (patch: Record<string, unknown> = {}) => ({
  symbol: 'MOCK',
  market: 'US',
  currency: 'USD',
  feeCurrency: 'USD',
  side: 'BUY',
  tradeStatus: 'FILLED',
  executedAt: '2026-01-05T15:00:00Z',
  sequence: '1',
  quantity: '2',
  executionPrice: '10',
  fee: '1',
  tax: '0.2',
  externalRef: 'mock-fill-1',
  referenceKind: 'FILL',
  ...patch,
});
export function syntheticLines(rows: readonly Record<string, unknown>[]) {
  return [SYNTHETIC_HEADER, ...rows.map((row) => JSON.stringify(row))];
}
export const extractedDocument = (lines: readonly string[], hash = 'a'.repeat(64)) => ({
  documentSha256: hash,
  method: 'PDF_TEXT' as const,
  issues: [],
  pages: [{ page: 1, lines: lines.map((text, i) => ({ line: i + 1, text, confidence: 1 })) }],
});

/** A small valid ASCII PDF; source data is synthetic and contains no personal information. */
export function syntheticPdf(lines: readonly string[] = ['MOCK document']): Uint8Array {
  const escape = (text: string) => text.replace(/[\\()]/g, '\\$&');
  const stream = `BT /F1 8 Tf 20 780 Td 10 TL ${lines.map((line) => `(${escape(line)}) Tj T*`).join('\n')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 2400 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export const syntheticContext = {
  accountId: 'mock-account',
  securities: [
    {
      symbol: 'MOCK',
      market: 'US' as const,
      currency: 'USD' as const,
      securityId: 'mock-security',
    },
  ],
};
