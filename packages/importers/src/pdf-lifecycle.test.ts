import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentExtractionError } from './extraction.js';
import { extractPdf } from './pdf-extractor.js';

// Only the external decoder is replaced. Hashing, streaming, limits and cleanup stay real.
const decoder = vi.hoisted(() => ({
  plan: { numPages: 1, chunks: ['MOCK recovered document'], stall: false },
  onStarted: undefined as (() => void) | undefined,
  onStreamStarted: undefined as (() => void) | undefined,
  resources: [] as {
    destroyed: boolean;
    pageReads: number;
    pageCleanups: number;
    streamClosed: boolean;
    streamCancellations: number;
    chunksEmitted: number;
  }[],
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  PasswordResponses: { INCORRECT_PASSWORD: 2 },
  getDocument: () => {
    const plan = decoder.plan;
    const resource = {
      destroyed: false,
      pageReads: 0,
      pageCleanups: 0,
      streamClosed: false,
      streamCancellations: 0,
      chunksEmitted: 0,
    };
    decoder.resources.push(resource);
    let streamController:
      | ReadableStreamDefaultController<{
          items: {
            str: string;
            transform: number[];
            width: number;
            height: number;
            hasEOL: boolean;
          }[];
        }>
      | undefined;
    const page = {
      streamTextContent: () =>
        new ReadableStream({
          start(controller) {
            streamController = controller;
            decoder.onStreamStarted?.();
          },
          pull(controller) {
            const str = plan.chunks[resource.chunksEmitted];
            if (str !== undefined) {
              resource.chunksEmitted += 1;
              controller.enqueue({
                items: [
                  { str, transform: [1, 0, 0, 1, 10, 10], width: 100, height: 10, hasEOL: true },
                ],
              });
            } else if (!plan.stall) {
              resource.streamClosed = true;
              controller.close();
            }
          },
          cancel() {
            resource.streamCancellations += 1;
            resource.streamClosed = true;
          },
        }),
      cleanup() {
        resource.pageCleanups += 1;
      },
    };
    const task = {
      promise: Promise.resolve({
        numPages: plan.numPages,
        getPage: async () => {
          resource.pageReads += 1;
          return page;
        },
      }),
      async destroy() {
        resource.destroyed = true;
        // PDF.js destruction also releases a pending text read, allowing page cleanup.
        if (streamController && !resource.streamClosed) {
          resource.streamClosed = true;
          streamController.close();
        }
      },
    };
    decoder.onStarted?.();
    return task;
  },
}));

const bytes = new TextEncoder().encode('%PDF-1.7\nMOCK lifecycle fixture');

function decodingStarted(): { document: Promise<void>; stream: Promise<void> } {
  return {
    document: new Promise<void>((resolve) => {
      decoder.onStarted = resolve;
    }),
    stream: new Promise<void>((resolve) => {
      decoder.onStreamStarted = resolve;
    }),
  };
}

async function expectRecovery(): Promise<void> {
  decoder.plan = { numPages: 1, chunks: ['MOCK recovered document'], stall: false };
  const result = await extractPdf(bytes, 'application/pdf');
  expect(result.pages).toHaveLength(1);
  expect(result.pages[0]?.lines).toEqual([
    { line: 1, text: 'MOCK recovered document', confidence: 1 },
  ]);
  expect(result.issues).toEqual([]);
  expect(decoder.resources.at(-1)).toMatchObject({
    destroyed: true,
    pageReads: 1,
    pageCleanups: 1,
    streamClosed: true,
  });
  expect(vi.getTimerCount()).toBe(0);
}

describe('PDF extraction resource lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    decoder.resources = [];
    decoder.onStarted = undefined;
    decoder.onStreamStarted = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects too many decoded pages before reading a page and destroys the loading task', async () => {
    decoder.plan = { numPages: 21, chunks: [], stall: false };
    await expect(extractPdf(bytes, 'application/pdf')).rejects.toMatchObject({
      name: 'DocumentExtractionError',
      code: 'PAGE_LIMIT',
      message: 'PAGE_LIMIT',
    });
    expect(decoder.resources[0]).toMatchObject({ destroyed: true, pageReads: 0, pageCleanups: 0 });
    expect(vi.getTimerCount()).toBe(0);
    await expectRecovery();
  });

  it('stops a streamed text overflow, cancels its reader and cleans up its page', async () => {
    decoder.plan = { numPages: 1, chunks: ['x'.repeat(250_000), 'y'.repeat(250_000)], stall: true };
    await expect(extractPdf(bytes, 'application/pdf')).rejects.toMatchObject({
      name: 'DocumentExtractionError',
      code: 'TEXT_LIMIT',
      message: 'TEXT_LIMIT',
    });
    expect(decoder.resources[0]).toEqual({
      destroyed: true,
      pageReads: 1,
      pageCleanups: 1,
      streamClosed: true,
      streamCancellations: 1,
      chunksEmitted: 2,
    });
    expect(vi.getTimerCount()).toBe(0);
    await expectRecovery();
  });

  it('times out a pending text read and releases document and page resources', async () => {
    decoder.plan = { numPages: 1, chunks: [], stall: true };
    const started = decodingStarted();
    const result = extractPdf(bytes, 'application/pdf');
    const rejection = expect(result).rejects.toMatchObject({
      name: 'DocumentExtractionError',
      code: 'TIMEOUT',
      message: 'TIMEOUT',
    });
    // Hashing is genuinely asynchronous; only advance once the decoder and timer exist.
    await started.document;
    await started.stream;
    expect(decoder.resources[0]?.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
    expect(decoder.resources[0]).toMatchObject({
      destroyed: true,
      pageReads: 1,
      pageCleanups: 1,
      streamClosed: true,
    });
    expect(vi.getTimerCount()).toBe(0);
    await expectRecovery();
  });

  it('aborts after decoding starts, removes its listener and permits a later extraction', async () => {
    decoder.plan = { numPages: 1, chunks: [], stall: true };
    const started = decodingStarted();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const result = extractPdf(bytes, 'application/pdf', { signal: controller.signal });
    const rejection = expect(result).rejects.toBeInstanceOf(DocumentExtractionError);
    await started.document;
    await started.stream;
    expect(decoder.resources[0]?.destroyed).toBe(false);
    controller.abort();
    await rejection;
    await expect(result).rejects.toMatchObject({ code: 'ABORTED', message: 'ABORTED' });
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(decoder.resources[0]).toMatchObject({
      destroyed: true,
      pageReads: 1,
      pageCleanups: 1,
      streamClosed: true,
    });
    expect(vi.getTimerCount()).toBe(0);
    await expectRecovery();
  });
});
