import { expect, it } from 'vitest';
import { createApp } from './app.js';

it('fails closed on private integrations without installation configuration', async () => {
  const response = await createApp().request('/api/integrations');
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
