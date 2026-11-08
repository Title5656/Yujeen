import {
  ExtractedDocumentSchema,
  ParsedDocumentImportSchema,
  IMPORT_LIMITS,
  type ParsedDocumentImport,
} from '@portfolio/contracts';
import { countConfirmationRows, parseConfirmationLayout } from './confirmation-layout.js';

/** Versioned reader for the inspected confirmation layout; unknown layouts stay in review. */
export class DimeParser {
  readonly id = 'dime-confirmation';
  readonly version = 'dime-confirmation-v1';

  parse(input: unknown): ParsedDocumentImport {
    const document = ExtractedDocumentSchema.parse(input);
    const text = document.pages.flatMap((page) => page.lines.map((line) => line.text)).join('\n');
    if (
      text.includes('Confirmation Note / Receipt / Tax Invoice') &&
      /(?:www\.)?dime\.co\.th|Dime!/.test(text)
    ) {
      const drafts = parseConfirmationLayout(document);
      const potentialRows = countConfirmationRows(document);
      if (drafts.length > IMPORT_LIMITS.rows) throw new Error('ROW_LIMIT');
      return ParsedDocumentImportSchema.parse({
        documentSha256: document.documentSha256,
        parserId: 'dime-confirmation',
        parserVersion: 'dime-confirmation-v1',
        dataMode: 'DOCUMENT',
        formatVerified: drafts.length > 0,
        issues: [
          ...document.issues,
          ...(drafts.length ? [] : ['UNSUPPORTED_CONFIRMATION_LAYOUT']),
          ...(potentialRows !== drafts.length ? ['UNREADABLE_TABLE_ROWS'] : []),
        ],
        drafts,
      });
    }
    return {
      documentSha256: document.documentSha256,
      parserId: 'dime-unverified',
      parserVersion: 'dime-unverified-v1',
      dataMode: 'DOCUMENT',
      formatVerified: false,
      issues: [...document.issues, 'UNVERIFIED_DIME_FORMAT'],
      drafts: [],
    };
  }
}
