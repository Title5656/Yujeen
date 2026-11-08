import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, HealthResponseSchema } from '@portfolio/contracts';
import { createApp } from './app.js';

describe('public foundation API', () => {
  it.each([
    '/api/imports',
    '/api/imports/preview',
    '/api/imports/confirm',
    '/api/transactions',
    '/api/ledger',
  ])(
    'does not expose private GET/POST import or ledger data at %s without authentication',
    async (path) => {
      for (const method of ['GET', 'POST']) {
        const response = await createApp().request(path, { method });
        expect(response.status).toBe(404);
        expect(ApiErrorSchema.parse(await response.json()).error.code).toBe('NOT_FOUND');
      }
    },
  );
  it('serves the exact minimal health contract', async () => {
    const response = await createApp().request('/api/health');
    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(await response.json())).toEqual({ status: 'ok' });
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it.each(['/api', '/api/missing', '/api/transactions', '/api/health/missing'])(
    'returns typed 404 errors for %s, including browser navigation',
    async (path) => {
      const response = await createApp().request(path, {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      });
      expect(response.status).toBe(404);
      expect(ApiErrorSchema.parse(await response.json()).error.code).toBe('NOT_FOUND');
    },
  );

  it('does not expose exception messages or stack traces', async () => {
    const app = createApp();
    app.get('/api/test-failure', () => {
      throw new Error('sensitive-internal-detail');
    });
    const response = await app.request('/api/test-failure');
    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(await response.json())).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
    });
  });
});
