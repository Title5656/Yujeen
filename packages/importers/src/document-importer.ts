import type { MockImportDocument } from '@portfolio/contracts';

export interface DocumentInput {
  readonly mediaType: string;
  readonly text: string;
}

export interface ImportDraft {
  readonly symbol: string;
  readonly quantity: string | null;
  readonly executionPrice: string | null;
  readonly tradeStatus: MockImportDocument['tradeStatus'];
  readonly status: 'NEEDS_REVIEW';
  readonly confirmable: false;
  readonly missingFields: readonly ('quantity' | 'executionPrice')[];
  readonly warnings: readonly string[];
}

export interface ImportResult {
  readonly dataMode: 'MOCK';
  readonly parserId: string;
  readonly parserVersion: string;
  readonly drafts: readonly ImportDraft[];
}

export interface DocumentImporter {
  readonly id: string;
  readonly version: string;
  parse(input: DocumentInput): Promise<ImportResult>;
}
