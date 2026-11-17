import { createMiddleware } from 'hono/factory';
import { installation } from '../config/installation.js';
import type { InstallBindings, Installation } from '../config/installation.js';
import type { FetchUpstream } from '../lib/transport.js';
import { ownerVerifier } from './owner.js';
import { failure } from './api-failure.js';

export type OwnerEnv = {
  Bindings: InstallBindings;
  Variables: { installation: Installation };
};

export function requireOwner(fetchUpstream: FetchUpstream, now: () => number) {
  const verify = ownerVerifier(fetchUpstream);
  return createMiddleware<OwnerEnv>(async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    const config = installation(c.env);
    if (!config) return c.json(failure('NOT_CONFIGURED'), 503);
    if (new URL(c.req.url).origin !== config.origin) return c.json(failure('FORBIDDEN'), 403);
    if (
      c.req.method !== 'GET' &&
      c.req.method !== 'HEAD' &&
      c.req.header('Origin') !== config.origin
    )
      return c.json(failure('FORBIDDEN'), 403);
    const status = await verify(c.req.header('Cf-Access-Jwt-Assertion'), config, now());
    if (status !== 200)
      return c.json(
        failure(status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE'),
        status,
      );
    c.set('installation', config);
    await next();
  });
}
