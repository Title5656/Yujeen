import { MarketDataError } from './provider.js';

export type Transport = (url: string, init?: RequestInit) => Promise<Response>;

export async function requestJson(
  url: string,
  fetchUpstream: Transport,
  now: () => number,
  headers?: Record<string, string>,
) {
  try {
    const response = await fetchUpstream(url, {
      ...(headers ? { headers } : {}),
      // Workers support manual redirects. Reject non-2xx below so credentials stay on the original host.
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new MarketDataError('AUTH_FAILED', 'Provider refused credentials or feed');
    }
    if (response.status === 429) {
      const raw = response.headers.get('Retry-After');
      const retryAfter =
        raw && /^\d{1,10}$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) : NaN;
      throw new MarketDataError(
        'RATE_LIMITED',
        'Provider rate limit',
        Number.isFinite(retryAfter)
          ? raw && /^\d+$/.test(raw)
            ? now() + retryAfter
            : retryAfter
          : undefined,
      );
    }
    if (!response.ok) throw new MarketDataError('PROVIDER_ERROR', 'Provider unavailable');
    // These endpoints return one pair or a small batch. Bound upstream response size.
    const reader = response.body?.getReader();
    if (!reader) throw new MarketDataError('PROVIDER_ERROR', 'Missing provider response');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let body = '';
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 64 * 1024) {
          await reader.cancel();
          throw new MarketDataError('PROVIDER_ERROR', 'Provider response too large');
        }
        body += decoder.decode(value, { stream: true });
      }
      return JSON.parse(body + decoder.decode()) as unknown;
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError('NETWORK', 'Invalid or unavailable provider response');
  }
}

export function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function decimal(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  const raw = String(value);
  const tiny = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(raw);
  return tiny && Number(tiny[3]) <= 12
    ? '0.' + '0'.repeat(Number(tiny[3]) - 1) + tiny[1] + (tiny[2] ?? '')
    : raw;
}
