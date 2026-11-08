import { useEffect, useRef, useState } from 'react';
import {
  IMPORT_LIMITS,
  type ExtractedDocument,
  type ParsedDocumentImport,
} from '@portfolio/contracts';
import { DimeParser, DocumentExtractionError } from '@portfolio/importers';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export function useLocalDocument() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    document: ExtractedDocument;
    parsed: ParsedDocumentImport;
  } | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function selectFile(selected: File | null) {
    active.current?.abort();
    active.current = null;
    setFile(selected);
    setPassword('');
    setError(null);
    setResult(null);
    setReading(false);
  }
  function clear() {
    selectFile(null);
    setInputKey((key) => key + 1);
  }
  async function read() {
    if (!file) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setReading(true);
    setError(null);
    setResult(null);
    try {
      if (file.size === 0 || file.size > IMPORT_LIMITS.fileBytes)
        throw new DocumentExtractionError('FILE_SIZE_LIMIT');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { extractPdf } = await import('@portfolio/importers/pdf');
      const document = await extractPdf(bytes, file.type, {
        password,
        workerSrc,
        signal: controller.signal,
      });
      if (!controller.signal.aborted)
        setResult({ document, parsed: new DimeParser().parse(document) });
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof DocumentExtractionError ? error.code : 'INVALID_PDF');
    } finally {
      if (active.current === controller) {
        setPassword('');
        setReading(false);
        active.current = null;
      }
    }
  }
  return { file, password, setPassword, reading, error, result, inputKey, selectFile, clear, read };
}
