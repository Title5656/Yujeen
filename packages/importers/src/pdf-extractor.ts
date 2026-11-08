import {
  ExtractedDocumentSchema,
  IMPORT_LIMITS,
  type ExtractedDocument,
} from '@portfolio/contracts';
import { documentSha256, DocumentExtractionError, validateDocumentBytes } from './extraction.js';

export interface PdfExtractionOptions {
  readonly password?: string;
  readonly workerSrc?: string;
  readonly signal?: AbortSignal;
}

/** Browser/local only. Bytes/password never leave the machine. No URL input is accepted. */
export async function extractPdf(
  bytes: Uint8Array,
  mediaType: string,
  options: PdfExtractionOptions = {},
): Promise<ExtractedDocument> {
  validateDocumentBytes(bytes, mediaType);
  if (options.signal?.aborted) throw new DocumentExtractionError('ABORTED');
  const documentSha = await documentSha256(bytes);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (options.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = options.workerSrc;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    password: options.password,
    verbosity: 0,
    stopAtErrors: true,
    useWorkerFetch: false,
    useWasm: false,
    enableXfa: false,
    disableFontFace: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const extraction = async (): Promise<ExtractedDocument> => {
      const pdf = await task.promise;
      if (pdf.numPages > IMPORT_LIMITS.pages) throw new DocumentExtractionError('PAGE_LIMIT');
      const pages: ExtractedDocument['pages'] = [];
      let characters = 0;
      let totalLines = 0;
      let needsOcr = false;
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const lines: ExtractedDocument['pages'][number]['lines'] = [];
        const items: NonNullable<ExtractedDocument['pages'][number]['items']> = [];
        let pendingItems: Omit<(typeof items)[number], 'line'>[] = [];
        const reader = page.streamTextContent().getReader();
        let current = '';
        let lastY: number | undefined;
        const flush = () => {
          if (current.trim()) {
            totalLines += 1;
            if (totalLines > IMPORT_LIMITS.lines) throw new DocumentExtractionError('TEXT_LIMIT');
            lines.push({ line: lines.length + 1, text: current.trim(), confidence: 1 });
            for (const item of pendingItems) items.push({ ...item, line: lines.length });
            if (items.length > IMPORT_LIMITS.items) throw new DocumentExtractionError('TEXT_LIMIT');
          }
          current = '';
          pendingItems = [];
        };
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const item of value.items) {
              if (!('str' in item)) continue;
              if (lastY !== undefined && item.transform[5] !== lastY) flush();
              characters += item.str.length + 1;
              if (characters > IMPORT_LIMITS.textCharacters)
                throw new DocumentExtractionError('TEXT_LIMIT');
              current += (current ? ' ' : '') + item.str;
              if (
                item.str.trim() &&
                Number.isFinite(item.transform[4]) &&
                Number.isFinite(item.transform[5])
              )
                pendingItems.push({
                  text: item.str.trim(),
                  x: item.transform[4]!,
                  y: item.transform[5]!,
                  width: item.width,
                  height: item.height,
                });
              lastY = item.transform[5];
              if (item.hasEOL) flush();
            }
          }
          flush();
        } finally {
          await reader.cancel().catch(() => undefined);
          page.cleanup();
        }
        if (lines.length === 0) needsOcr = true;
        pages.push({ page: index, lines, items });
      }
      return ExtractedDocumentSchema.parse({
        documentSha256: documentSha,
        method: 'PDF_TEXT',
        pages,
        issues: needsOcr ? ['OCR_REQUIRED'] : [],
      });
    };
    return await Promise.race([
      extraction(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DocumentExtractionError('TIMEOUT')),
          IMPORT_LIMITS.timeoutMs,
        );
        onAbort = () => reject(new DocumentExtractionError('ABORTED'));
        options.signal?.addEventListener('abort', onAbort, { once: true });
        if (options.signal?.aborted) onAbort();
      }),
    ]);
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error;
    if (error instanceof Error && error.name === 'PasswordException') {
      const code =
        'code' in error && error.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD
          ? 'INCORRECT_PASSWORD'
          : 'PASSWORD_REQUIRED';
      throw new DocumentExtractionError(code);
    }
    throw new DocumentExtractionError('INVALID_PDF');
  } finally {
    clearTimeout(timer);
    if (onAbort) options.signal?.removeEventListener('abort', onAbort);
    await task.destroy();
  }
}
