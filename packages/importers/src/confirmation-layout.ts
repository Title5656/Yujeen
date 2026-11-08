import {
  TRADE_DOCUMENT_FIELDS,
  type DraftTrade,
  type ExtractedDocument,
  type TextPosition,
} from '@portfolio/contracts';

const labels = [
  'Order ID',
  'Settlement Date',
  'Transaction Type',
  'Securities',
  'Unit',
  'Unit Price',
  'Currency',
  'Gross Amount',
  'Fee Include Vat',
  'Withholding Tax',
  'Total Amount',
] as const;
const numeric = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

export function countConfirmationRows(document: ExtractedDocument): number {
  let count = 0;
  for (const page of document.pages) {
    const items = page.items ?? [];
    const tableHeaders = items.filter((i) =>
      ['Order ID', 'Settlement Date', 'Unit'].includes(clean(i.text)),
    );
    if (tableHeaders.length === 0) continue;
    const bottom = Math.min(...tableHeaders.map((i) => i.y));
    // Independent anchors keep an unreadable side/currency from making a row disappear.
    const anchors = items
      .filter(
        (i) =>
          i.y < bottom - 12 &&
          ((i.x >= 25 && i.x < 65 && /^\d+$/.test(i.text)) ||
            (i.x >= 65 && i.x < 120 && /^\d{2}\/\d{2}\/\d{4}$/.test(i.text)) ||
            (i.x >= 240 && i.x < 290 && numeric.test(i.text))),
      )
      .sort((a, b) => b.y - a.y);
    const groups: number[] = [];
    for (const item of anchors)
      if (!groups.some((y) => Math.abs(y - item.y) <= 8)) groups.push(item.y);
    count += groups.length;
  }
  return count;
}
function date(value: string | undefined): string | null {
  const m = value && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number(m[3]) >= 1900 &&
    Number(m[3]) <= 2200 &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

/** Column assignment uses PDF positions, never the order in which the PDF draws text. */
export function parseConfirmationLayout(document: ExtractedDocument): DraftTrade[] {
  const drafts: DraftTrade[] = [];
  const all = document.pages.flatMap((p) =>
    (p.items ?? []).map((item) => ({ ...item, sourcePage: p.page })),
  );
  const dateForLabel = (label: (typeof all)[number]) =>
    all.filter(
      (i) =>
        i.sourcePage === label.sourcePage &&
        date(i.text) &&
        i.x > label.x &&
        i.x < label.x + 180 &&
        Math.abs(i.y - label.y) <= 8,
    );
  const datedHeaders = all
    .filter((i) => clean(i.text) === 'Effective Date')
    .map((label) => ({ label, values: dateForLabel(label) }));
  const globalValues = datedHeaders.flatMap((h) => (h.values.length === 1 ? h.values : []));
  for (const page of document.pages) {
    const items = page.items ?? [];
    const ownDates = datedHeaders.filter((h) => h.label.sourcePage === page.page);
    const effective =
      ownDates.length === 1
        ? ownDates[0]!.values.length === 1
          ? ownDates[0]!.values[0]
          : undefined
        : ownDates.length === 0 && new Set(globalValues.map((i) => i.text)).size === 1
          ? globalValues[0]
          : undefined;
    const headers = labels.map((label) => items.filter((i) => clean(i.text) === label));
    if (headers.some((h) => h.length !== 1)) continue;
    const columns = headers.map((h) => h[0]!);
    if (columns.some((h, i) => i > 0 && h.x <= columns[i - 1]!.x)) continue;
    const headerBottom = Math.min(...columns.map((h) => h.y));
    const col = (item: TextPosition, index: number) =>
      item.x >= columns[index]!.x - 5 && item.x < (columns[index + 1]?.x ?? Infinity) - 5;
    const sides = items
      .filter((i) => /^(BUY|SELL)$/.test(i.text) && col(i, 2) && i.y < headerBottom - 12)
      .sort((a, b) => b.y - a.y);
    for (const [rowIndex, side] of sides.entries()) {
      const upper = rowIndex === 0 ? headerBottom - 10 : (sides[rowIndex - 1]!.y + side.y) / 2;
      const lower = sides[rowIndex + 1] ? (sides[rowIndex + 1]!.y + side.y) / 2 : side.y - 18;
      const row = items.filter((i) => i.y < upper && i.y > lower && Math.abs(i.y - side.y) < 18);
      const pick = (
        column: number,
        accept: (i: TextPosition) => boolean = () => true,
      ): TextPosition | undefined => {
        const found = row.filter((i) => col(i, column) && accept(i));
        return found.length === 1 ? found[0] : undefined;
      };
      const number = (column: number, thb = false) =>
        pick(column, (i) => numeric.test(i.text) && (thb ? i.y < side.y - 2 : i.y >= side.y - 2));
      const orderId = pick(0, (i) => /^[A-Za-z0-9-]{1,64}$/.test(i.text));
      const settlement = pick(1, (i) => date(i.text) !== null);
      const symbol = pick(3, (i) => /^[A-Z][A-Z0-9./-]{0,31}$/.test(i.text));
      const venue = pick(3, (i) => /^\[[A-Z0-9 -]+\]$/.test(i.text));
      const quantity = number(4),
        price = number(5),
        currency = pick(6, (i) => /^[A-Z]{3}$/.test(i.text));
      const gross = number(7),
        fee = number(8),
        tax = number(9),
        net = number(10);
      const raw = (i: TextPosition | undefined) => (i ? i.text.replace(/,/g, '') : null);
      const evidence = (i: TextPosition) => {
        const sourcePage =
          'sourcePage' in i && typeof i.sourcePage === 'number' ? i.sourcePage : page.page;
        return {
          page: sourcePage,
          line: i.line,
          confidence:
            document.pages.find((p) => p.page === sourcePage)?.lines.find((l) => l.line === i.line)
              ?.confidence ?? 0,
        };
      };
      const fields = Object.fromEntries(
        TRADE_DOCUMENT_FIELDS.map((f) => [f, null]),
      ) as DraftTrade['fields'];
      fields.symbol = symbol?.text ?? null;
      fields.side = side.text;
      fields.quantity = raw(quantity);
      fields.currency = currency?.text ?? null;
      fields.fee = raw(fee);
      fields.tax = raw(tax);
      fields.feeCurrency = currency?.text ?? null;
      fields.market =
        venue &&
        /^\[(US|XNAS|XNYS|ARCX|XASE|NASDAQ|NYSE|NYSEARCA|AMEX|BATS|ARCA|IEX|CBOE)\]$/.test(
          venue.text,
        )
          ? 'US'
          : null;
      const sources = {
        symbol,
        side,
        quantity,
        currency,
        fee,
        tax,
        feeCurrency: currency,
        market: venue,
      };
      const orderSources = {
        orderId,
        effectiveDate: effective,
        settlementDate: settlement,
        unitPrice: price,
        grossAmount: gross,
        netAmount: net,
        exchange: venue,
      };
      drafts.push({
        sourceRow: drafts.length + 1,
        fields,
        evidence: Object.fromEntries(
          Object.entries(sources).flatMap(([key, item]) => (item ? [[key, evidence(item)]] : [])),
        ),
        documentOrder: {
          orderId: orderId?.text ?? null,
          effectiveDate: date(effective?.text),
          settlementDate: date(settlement?.text),
          unitPrice: raw(price),
          grossAmount: raw(gross),
          netAmount: raw(net),
          exchange: venue?.text ?? null,
          thbAmounts: {
            grossAmount: raw(number(7, true)),
            fee: raw(number(8, true)),
            tax: raw(number(9, true)),
            netAmount: raw(number(10, true)),
          },
          evidence: Object.fromEntries(
            Object.entries(orderSources).flatMap(([key, item]) =>
              item ? [[key, evidence(item)]] : [],
            ),
          ),
        },
      });
    }
  }
  return drafts;
}
