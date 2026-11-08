/** MOCK amounts/identities; column labels and placement follow the inspected template only. */
export function confirmationFixture(patches: Record<string, string | null>[] = [{}]) {
  const items: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    line: number;
  }[] = [];
  function put(text: string | null, x: number, y: number) {
    if (text !== null)
      items.push({ text, x, y, width: text.length * 2.5, height: 6, line: items.length + 1 });
  }
  put('Confirmation Note / Receipt / Tax Invoice', 20, 800);
  put('www.dime.co.th', 20, 100);
  put('Effective Date', 247, 589);
  put('06/01/2026', 315, 589);
  put('Issue Date', 409, 590);
  put('07/01/2026', 500, 590);
  for (const [text, x, y] of [
    ['Order ID', 33, 498],
    ['Settlement Date', 72, 494],
    ['Transaction Type', 123, 494],
    ['Securities', 188, 497],
    ['Unit', 250, 497],
    ['Unit Price', 295, 510],
    ['Currency', 342, 510],
    ['Gross Amount', 383, 510],
    ['Fee Include Vat', 434, 507],
    ['Withholding Tax', 483, 507],
    ['Total Amount', 535, 509],
  ] as const)
    put(text, x, y);
  for (const [i, patch] of patches.entries()) {
    const r = {
      orderId: String(900001 + i),
      symbol: 'MOCK',
      side: 'BUY',
      quantity: '0.1234567',
      unitPrice: '250.50',
      currency: 'USD',
      grossAmount: '30.93',
      fee: '0.50',
      tax: '0.10',
      netAmount: '31.53',
      settlementDate: '08/01/2026',
      exchange: '[XNAS]',
      ...patch,
    };
    const y = 456 - i * 40;
    put(r.orderId!, 34, y);
    put(r.settlementDate!, 77, y);
    put(r.side!, 138, y);
    put(r.symbol!, 194, y + 5);
    put(r.exchange!, 192, y - 6);
    put(r.quantity!, 250, y + 1);
    put(r.unitPrice!, 312, y + 1);
    put(r.currency!, 351, y + 1);
    for (const [field, x] of [
      ['grossAmount', 406],
      ['fee', 460],
      ['tax', 508],
      ['netAmount', 553],
    ] as const) {
      put(r[field]!, x, y + 4);
      put(
        field === 'grossAmount' ? '1000.00' : field === 'netAmount' ? '1018.00' : '3.00',
        x,
        y - 7,
      );
    }
  }
  return {
    documentSha256: 'd'.repeat(64),
    method: 'PDF_TEXT' as const,
    issues: [],
    pages: [
      { page: 1, lines: items.map((i) => ({ line: i.line, text: i.text, confidence: 1 })), items },
    ],
  };
}

export function confirmationPdf(patches: Record<string, string | null>[] = [{}]) {
  const items = confirmationFixture(patches).pages[0]!.items;
  const esc = (s: string) => s.replace(/[\\()]/g, '\\$&');
  const stream = items.map((i) => `BT /F1 6 Tf ${i.x} ${i.y} Td (${esc(i.text)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (const [i, obj] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
