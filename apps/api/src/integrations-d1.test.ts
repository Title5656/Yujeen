/// <reference types="node" />
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

type TestBindings = { DB: D1Database; OTHER_DB: D1Database };
let proxy: Awaited<ReturnType<typeof getPlatformProxy<TestBindings>>>;
let env: TestBindings;

const origin = 'https://yujeen.example.workers.dev';
const issuer = 'https://example.cloudflareaccess.com';
const now = Date.parse('2026-11-15T15:30:00Z');
const settings = '/api/integrations';
const credentials = { provider: 'alpaca', keyId: 'synthetic-key', secret: 'synthetic-secret' };
const encode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const jsonPart = (value: unknown) => encode(new TextEncoder().encode(JSON.stringify(value)));
const key = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
if (!('publicKey' in key)) throw new Error('Expected an RSA key pair');
const { publicKey, privateKey } = key;
const jwk = await crypto.subtle.exportKey('jwk', publicKey);
async function token(overrides: Record<string, unknown> = {}) {
  const input =
    jsonPart({ alg: 'RS256', kid: 'test' }) +
    '.' +
    jsonPart({
      email: 'owner@example.test',
      iss: issuer,
      aud: ['test-audience'],
      exp: now / 1000 + 600,
      type: 'app',
      ...overrides,
    });
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(input),
  );
  return input + '.' + encode(new Uint8Array(signature));
}

function fixture(db = env.DB, owner = 'owner@example.test') {
  const calls: string[] = [];
  let fail = false;
  let currentTime = now;
  const upstream = async (url: string, init?: RequestInit) => {
    const target = new URL(url);
    expect(init?.redirect).toBe('manual');
    if (target.origin === issuer) return Response.json({ keys: [{ ...jwk, kid: 'test' }] });
    calls.push(target.href);
    if (target.hostname === 'api.frankfurter.dev') {
      return Response.json({ date: '2026-11-13', base: 'USD', quote: 'THB', rate: 35 });
    }
    expect(target.origin).toBe('https://data.alpaca.markets');
    expect(target.searchParams.get('feed')).toBe('iex');
    if (fail || new Headers(init?.headers).get('APCA-API-KEY-ID') === 'bad-key') {
      return new Response(null, { status: fail ? 429 : 401, headers: { 'Retry-After': '60' } });
    }
    const symbols = target.searchParams.get('symbols')?.split(',') ?? [];
    const trade = { p: 123.45, t: '2026-11-15T15:29:58.123456Z' };
    return Response.json({
      trades: Object.fromEntries(
        symbols
          .filter((symbol) => ['AAPL', 'V', 'NVDA'].includes(symbol))
          .map((symbol) => [symbol, trade]),
      ),
    });
  };
  const bindings = {
    DB: db,
    OWNER_EMAIL: owner,
    ACCESS_ISSUER: issuer,
    ACCESS_AUDIENCE: 'test-audience',
    APP_ORIGIN: origin,
    MASTER_ENCRYPTION_KEY: btoa('test-key-only'.padEnd(32, '0')),
    ENABLE_ALPACA: 'true',
    ENABLE_FRANKFURTER: 'true',
  };
  const app = createApp({ fetch: upstream, now: () => currentTime });
  const request = async (
    path: string,
    options: {
      method?: string;
      body?: unknown;
      jwt?: string;
      site?: string;
      from?: string;
      config?: Record<string, unknown>;
    } = {},
  ) =>
    app.request(
      (options.site ?? origin) + path,
      {
        method: options.method ?? 'GET',
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        headers: {
          'Content-Type': 'application/json',
          Origin: options.from ?? origin,
          'Cf-Access-Jwt-Assertion':
            options.jwt ?? (await token({ email: owner, exp: currentTime / 1000 + 600 })),
        },
      },
      { ...bindings, ...options.config },
    );
  return {
    request,
    calls,
    advance: (ms: number) => {
      currentTime += ms;
    },
    rateLimit: (enabled = true) => {
      fail = enabled;
    },
  };
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestBindings>({
    configPath: fileURLToPath(new NodeURL('../wrangler.test.jsonc', import.meta.url)),
    persist: false,
    remoteBindings: false,
    envFiles: [],
  });
  env = proxy.env;
  const folder = new NodeURL('../../../packages/database/migrations/', import.meta.url);
  const files = (await readdir(folder)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new NodeURL(file, folder), 'utf8');
    for (const db of [env.DB, env.OTHER_DB]) {
      await db.batch(
        sql
          .split('--> statement-breakpoint')
          .filter((s) => s.trim())
          .map((s) => db.prepare(s)),
      );
    }
  }
});
afterAll(async () => {
  await proxy?.dispose();
});
beforeEach(async () => {
  for (const db of [env.DB, env.OTHER_DB]) {
    await db.batch(
      ['market_credentials', 'market_cache', 'market_budget'].map((table) =>
        db.prepare('DELETE FROM ' + table),
      ),
    );
  }
});

describe('M3 installation boundary', () => {
  it('fails closed while unconfigured and rejects spoofed, expired, wrong-audience and wrong-owner requests', async () => {
    const { request, calls } = fixture();
    expect((await request(settings, { config: { OWNER_EMAIL: undefined } })).status).toBe(503);
    expect((await request(settings, { jwt: '' })).status).toBe(401);
    expect((await request(settings, { jwt: await token({ exp: now / 1000 - 1 }) })).status).toBe(
      401,
    );
    expect(
      (await request(settings, { jwt: await token({ iss: 'https://bad.example' }) })).status,
    ).toBe(401);
    expect((await request(settings, { jwt: await token({ aud: ['wrong'] }) })).status).toBe(401);
    const signed = await token();
    expect(
      (await request(settings, { jwt: signed.slice(0, signed.lastIndexOf('.') + 1) + 'ZmFrZQ' }))
        .status,
    ).toBe(401);
    expect(
      (await request(settings, { jwt: await token({ email: 'other@example.test' }) })).status,
    ).toBe(403);
    expect(
      (await request(settings, { site: 'https://alternate.example.workers.dev' })).status,
    ).toBe(403);
    expect(
      (
        await request(settings + '/candidate', {
          method: 'PUT',
          body: credentials,
          from: 'https://other.example',
        })
      ).status,
    ).toBe(403);
    expect((await request(settings)).headers.get('Cache-Control')).toContain('no-store');
    expect(calls).toEqual([]);
  });

  it('encrypts candidates and only activates a tested version, keeping the previous version on failure', async () => {
    const { request, advance } = fixture();
    const save = (body: unknown) => request(settings + '/candidate', { method: 'PUT', body });
    const action = (path: string, version: string) =>
      request(settings + path, { method: 'POST', body: { version } });
    const saved = await save(credentials);
    expect(saved.status).toBe(200);
    const raw = await saved.text();
    expect(raw).not.toContain(credentials.keyId);
    expect(raw).not.toContain(credentials.secret);
    const { candidate } = JSON.parse(raw);
    const stored = await env.DB.prepare('SELECT ciphertext FROM market_credentials').first<string>(
      'ciphertext',
    );
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(credentials.secret);
    expect((await action('/activate', candidate.version)).status).toBe(409);
    expect((await action('/test', candidate.version)).status).toBe(200);
    const active = await action('/activate', candidate.version);
    expect((await active.json<{ active: { version: string } }>()).active.version).toBe(
      candidate.version,
    );
    const failed = await (
      await save({ ...credentials, keyId: 'bad-key' })
    ).json<{ candidate: { version: string } }>();
    advance(60_000);
    expect((await action('/test', failed.candidate.version)).status).toBe(502);
    expect((await action('/activate', failed.candidate.version)).status).toBe(409);
    expect(
      (await (await request(settings)).json<{ active: { version: string } }>()).active.version,
    ).toBe(candidate.version);
    const other = fixture(env.OTHER_DB, 'other@example.test');
    expect((await (await other.request(settings)).json<{ active: unknown }>()).active).toBeNull();
    expect((await other.request(settings, { jwt: await token() })).status).toBe(403);
    const otherSave = await other.request(settings + '/candidate', {
      method: 'PUT',
      body: { ...credentials, keyId: 'other-fixture-key', secret: 'other-fixture-secret' },
      config: { MASTER_ENCRYPTION_KEY: btoa('different-test-key'.padEnd(32, '0')) },
    });
    expect(otherSave.status).toBe(200);
    const otherCandidate = (await otherSave.json<{ candidate: { version: string } }>()).candidate;
    expect(
      (
        await other.request(settings + '/test', {
          method: 'POST',
          body: { version: otherCandidate.version },
        })
      ).status,
    ).toBe(502);
    expect(other.calls).toHaveLength(0);
  });

  it('shares cache and budget, preserves real timestamps on rate limit, and never falls back to MOCK', async () => {
    const { request, calls, advance, rateLimit } = fixture();
    const saved = await request(settings + '/candidate', { method: 'PUT', body: credentials });
    const { candidate } = await saved.json<{ candidate: { version: string } }>();
    for (const action of ['test', 'activate']) {
      expect(
        (
          await request(settings + '/' + action, {
            method: 'POST',
            body: { version: candidate.version },
          })
        ).status,
      ).toBe(200);
    }
    advance(60_000);
    const refresh = () =>
      request('/api/market-data/refresh', { method: 'POST', body: { symbols: ['AAPL'] } });
    await Promise.all([refresh(), refresh()]);
    expect(calls.filter((url) => url.includes('alpaca'))).toHaveLength(2);
    expect(calls.filter((url) => url.includes('frankfurter'))).toHaveLength(1);
    const read = () => request('/api/market-data?symbols=AAPL');
    const live = await (await read()).json();
    expect(live).toMatchObject({
      quotes: [{ price: '123.45', feed: 'IEX', dataMode: 'LIVE' }],
      fx: { rate: '35', date: '2026-11-13' },
    });
    advance(16 * 60_000);
    rateLimit();
    const limited = {
      reason: 'UPSTREAM_RATE_LIMIT',
      retryAt: new Date(now + 32 * 60_000).toISOString(),
    };
    expect(await (await refresh()).json()).toMatchObject({ quoteWait: limited });
    expect(await (await refresh()).json()).toMatchObject({ quoteWait: limited });
    expect(calls.filter((url) => url.includes('alpaca'))).toHaveLength(3);
    expect(await (await read()).json()).toMatchObject({
      quotes: [{ asOf: '2026-11-15T15:29:58.123Z', stale: true, dataMode: 'LIVE' }],
    });
    rateLimit(false);
    advance(16 * 60_000);
    const replacement = await request(settings + '/candidate', {
      method: 'PUT',
      body: { ...credentials, keyId: 'replacement-fixture-key' },
    });
    const next = (await replacement.json<{ candidate: { version: string } }>()).candidate.version;
    for (const action of ['test', 'activate']) {
      const result = await request(settings + '/' + action, {
        method: 'POST',
        body: { version: next },
      });
      expect(result.status).toBe(200);
    }
    expect(await (await read()).json()).toMatchObject({ quotes: [], quoteStatus: 'UNAVAILABLE' });
  });

  it('looks up an uncached ticker after the shared cooldown and reuses fresh per-ticker cache', async () => {
    const { request, calls, advance } = fixture();
    const saved = await request(settings + '/candidate', { method: 'PUT', body: credentials });
    const { candidate } = await saved.json<{ candidate: { version: string } }>();
    for (const action of ['test', 'activate']) {
      const response = await request(settings + '/' + action, {
        method: 'POST',
        body: { version: candidate.version },
      });
      expect(response.status).toBe(200);
    }
    const refresh = async (...symbols: string[]) =>
      (await request('/api/market-data/refresh', { method: 'POST', body: { symbols } })).json();

    advance(60_000);
    expect(await refresh('AAPL')).toMatchObject({ quotes: [{ symbol: 'AAPL' }] });
    expect(await refresh('V')).toMatchObject({
      quotes: [],
      quoteWait: {
        reason: 'COOLDOWN',
        retryAt: new Date(now + 120_000).toISOString(),
        delayMs: 60_000,
      },
      quoteResults: [{ symbol: 'V', status: 'NOT_REQUESTED' }],
    });

    advance(60_000);
    expect(await refresh('AAPL', 'V', 'NVDA', 'UNKNOWN')).toMatchObject({
      quotes: expect.arrayContaining([
        expect.objectContaining({ symbol: 'V' }),
        expect.objectContaining({ symbol: 'NVDA' }),
      ]),
      quoteResults: expect.arrayContaining([
        { symbol: 'V', status: 'PRICE' },
        { symbol: 'NVDA', status: 'PRICE' },
        { symbol: 'UNKNOWN', status: 'NO_TRADE' },
      ]),
    });
    const alpacaCalls = calls.filter((url) => url.includes('data.alpaca.markets'));
    expect(alpacaCalls).toHaveLength(3);
    expect(alpacaCalls[2]).toContain('symbols=V%2CNVDA%2CUNKNOWN');
    advance(60_000);
    expect(await refresh('UNKNOWN')).toMatchObject({
      quotes: [],
      quoteStatus: 'OK',
      quoteResults: [{ symbol: 'UNKNOWN', status: 'NO_TRADE' }],
    });

    await env.DB.prepare("UPDATE market_budget SET day_count=96 WHERE provider='alpaca'").run();
    expect(await refresh('ASML')).toMatchObject({
      quoteWait: { reason: 'DAILY_QUOTA', retryAt: '2026-11-16T00:00:00.000Z' },
    });
    await env.DB.prepare("UPDATE market_budget SET month_count=2976 WHERE provider='alpaca'").run();
    expect(await refresh('ASML')).toMatchObject({
      quoteWait: { reason: 'MONTHLY_QUOTA', retryAt: '2026-12-01T00:00:00.000Z' },
    });
  });

  it('blocks new connection tests at the shared daily cap and never dispatches when D1 cannot reserve quota', async () => {
    const { request, calls } = fixture();
    const save = await request(settings + '/candidate', { method: 'PUT', body: credentials });
    const { candidate } = await save.json<{ candidate: { version: string } }>();
    const check = () =>
      request(settings + '/test', { method: 'POST', body: { version: candidate.version } });
    await env.DB.prepare(
      `INSERT INTO market_budget (provider, day, day_count, month, month_count, next_at, refresh_at, lease, lease_until, status) VALUES
      ('alpaca', '2026-11-15', 96, '2026-11', 96, 0, 0, '', 0, 'OK')`,
    ).run();
    expect((await check()).status).toBe(429);
    await env.DB.prepare(
      `CREATE TRIGGER fixture_budget_failure BEFORE UPDATE ON market_budget
      BEGIN SELECT RAISE(ABORT, 'synthetic private storage failure'); END`,
    ).run();
    try {
      expect(calls).toEqual([]);
      const live = fixture(env.DB);
      live.advance(24 * 60 * 60_000);
      const failure = await live.request(settings + '/test', {
        method: 'POST',
        body: { version: candidate.version },
      });
      expect(failure.status).toBe(500);
      expect(await failure.text()).not.toContain('synthetic private storage failure');
      expect(live.calls).toEqual([]);
    } finally {
      await env.DB.prepare('DROP TRIGGER fixture_budget_failure').run();
    }
  });
});
