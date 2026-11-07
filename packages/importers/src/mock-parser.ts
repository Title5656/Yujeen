import { MockImportDocumentSchema } from '@portfolio/contracts';
import type {
  DocumentImporter,
  DocumentInput,
  ImportDraft,
  ImportResult,
} from './document-importer.js';

/** Not a Dime parser; accepts only the explicitly tagged synthetic JSON protocol. */
export class MockParser implements DocumentImporter {
  readonly id = 'mock';
  readonly version = '0.0.0';

  async parse(input: DocumentInput): Promise<ImportResult> {
    if (input.mediaType !== 'application/x-portfolio-mock+json') {
      throw new Error(
        'MOCK parser accepts synthetic JSON only; real Dime parsing is not implemented',
      );
    }
    const document = MockImportDocumentSchema.parse(JSON.parse(input.text));
    const missingFields: ('quantity' | 'executionPrice')[] = [];
    if (document.quantity === null) missingFields.push('quantity');
    if (document.executionPrice === null) missingFields.push('executionPrice');
    const draft: ImportDraft = {
      symbol: document.symbol,
      quantity: document.quantity,
      executionPrice: document.executionPrice,
      tradeStatus: document.tradeStatus,
      status: 'NEEDS_REVIEW',
      confirmable: false,
      missingFields,
      warnings: ['MOCK: ข้อมูลจำลองเท่านั้น ยังไม่รองรับเอกสาร Dime จริง'],
    };
    return { dataMode: 'MOCK', parserId: this.id, parserVersion: this.version, drafts: [draft] };
  }
}
