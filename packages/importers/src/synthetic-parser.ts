import {
  ExtractedDocumentSchema,
  ParsedDocumentImportSchema,
  TRADE_DOCUMENT_FIELDS,
  IMPORT_LIMITS,
  type DraftTrade,
  type ParsedDocumentImport,
  type RawTradeFields,
} from '@portfolio/contracts';

/** Invented, explicitly tagged fixture protocol. This is NOT an actual Dime layout. */
export class SyntheticDimeParser {
  readonly id = 'synthetic-dime';
  readonly version = 'synthetic-dime-v1';

  parse(input: unknown): ParsedDocumentImport {
    const document = ExtractedDocumentSchema.parse(input);
    const lines = document.pages.flatMap((page) =>
      page.lines.map((line) => ({ ...line, page: page.page })),
    );
    if (lines[0]?.text !== 'YUJEEN_SYNTHETIC_DIME_V1') throw new Error('SYNTHETIC_FORMAT_REQUIRED');
    if (lines.length - 1 > IMPORT_LIMITS.rows) throw new Error('ROW_LIMIT');
    const drafts: DraftTrade[] = lines.slice(1).map((line, index) => {
      try {
        const value: unknown = JSON.parse(line.text);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        const raw = value as Record<string, unknown>;
        if (
          Object.keys(raw).some(
            (field) =>
              !TRADE_DOCUMENT_FIELDS.includes(field as (typeof TRADE_DOCUMENT_FIELDS)[number]),
          )
        )
          throw new Error();
        const fields = Object.fromEntries(
          TRADE_DOCUMENT_FIELDS.map((field) => {
            const val = raw[field];
            if (val !== undefined && val !== null && typeof val !== 'string') throw new Error();
            return [field, val ?? null];
          }),
        ) as RawTradeFields;
        const evidence = Object.fromEntries(
          TRADE_DOCUMENT_FIELDS.filter((field) => fields[field] !== null).map((field) => [
            field,
            { page: line.page, line: line.line, confidence: line.confidence },
          ]),
        );
        return { sourceRow: index + 1, fields, evidence };
      } catch {
        throw new Error('INVALID_SYNTHETIC_ROW');
      }
    });
    return ParsedDocumentImportSchema.parse({
      documentSha256: document.documentSha256,
      parserId: this.id,
      parserVersion: this.version,
      dataMode: 'MOCK',
      formatVerified: false,
      issues: [...document.issues],
      drafts,
    });
  }
}
