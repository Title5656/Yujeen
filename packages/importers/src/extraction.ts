import { IMPORT_LIMITS } from '@portfolio/contracts';

export type ExtractionErrorCode =
  | 'FILE_SIZE_LIMIT'
  | 'UNSUPPORTED_TYPE'
  | 'INVALID_SIGNATURE'
  | 'INVALID_PDF'
  | 'PAGE_LIMIT'
  | 'TEXT_LIMIT'
  | 'PASSWORD_REQUIRED'
  | 'INCORRECT_PASSWORD'
  | 'TIMEOUT'
  | 'ABORTED';

/** Only safe codes cross the UI boundary, never PDF text, library errors or passwords. */
export class DocumentExtractionError extends Error {
  constructor(readonly code: ExtractionErrorCode) {
    super(code);
    this.name = 'DocumentExtractionError';
  }
}
export function validateDocumentBytes(bytes: Uint8Array, mediaType: string): void {
  if (bytes.byteLength === 0 || bytes.byteLength > IMPORT_LIMITS.fileBytes)
    throw new DocumentExtractionError('FILE_SIZE_LIMIT');
  if (mediaType !== 'application/pdf') throw new DocumentExtractionError('UNSUPPORTED_TYPE');
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
    throw new DocumentExtractionError('INVALID_SIGNATURE');
}
export async function documentSha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
