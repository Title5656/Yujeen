import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMarketRepository } from '@portfolio/database';
import {
  AlpacaCredentialsSchema,
  IntegrationsSchema,
  MarketDataSchema,
  SymbolsInputSchema,
  VersionInputSchema,
} from '@portfolio/contracts';
import { requireOwner } from '../../middleware/require-owner.js';
import type { OwnerEnv } from '../../middleware/require-owner.js';
import { failure } from '../../middleware/api-failure.js';
import type { FetchUpstream } from '../../lib/transport.js';
import { marketService } from './service.js';

export interface MarketDependencies {
  fetch?: FetchUpstream;
  now?: () => number;
}
type PrivateEnv = {
  Bindings: OwnerEnv['Bindings'];
  Variables: OwnerEnv['Variables'] & {
    market: ReturnType<typeof marketService>;
    alpacaEnabled: boolean;
  };
};

export function marketRoutes(deps: MarketDependencies) {
  const app = new Hono<PrivateEnv>();
  const now = deps.now ?? Date.now;
  const fetchUpstream: FetchUpstream = deps.fetch ?? ((url, init) => fetch(url, init));

  app.use('*', requireOwner(fetchUpstream, now));
  app.use('*', async (c, next) => {
    const config = c.var.installation;
    c.set('market', marketService(config, createMarketRepository(config.db), fetchUpstream, now));
    c.set('alpacaEnabled', config.alpaca);
    await next();
  });

  app.use('*', bodyLimit({ maxSize: 4096, onError: (c) => c.json(failure('INVALID_INPUT'), 413) }));

  const settings = new Hono<PrivateEnv>();
  settings.get('/', async (c) => c.json(IntegrationsSchema.parse(await c.var.market.settings())));
  settings.put('/candidate', async (c) => {
    if (!c.var.alpacaEnabled) return c.json(failure('NOT_CONFIGURED'), 503);
    const input = AlpacaCredentialsSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json(failure('INVALID_INPUT'), 400);
    return c.json(IntegrationsSchema.parse(await c.var.market.save(input.data)));
  });
  settings.post('/test', async (c) => {
    if (!c.var.alpacaEnabled) return c.json(failure('NOT_CONFIGURED'), 503);
    const input = VersionInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json(failure('INVALID_INPUT'), 400);
    const result = await c.var.market.test(input.data.version);
    if (result !== 'OK')
      return c.json(
        failure(result),
        result === 'CONFLICT' ? 409 : result === 'RATE_LIMITED' ? 429 : 502,
      );
    return c.json(IntegrationsSchema.parse(await c.var.market.settings()));
  });
  settings.post('/activate', async (c) => {
    if (!c.var.alpacaEnabled) return c.json(failure('NOT_CONFIGURED'), 503);
    const input = VersionInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json(failure('INVALID_INPUT'), 400);
    if (!(await c.var.market.activate(input.data.version))) return c.json(failure('CONFLICT'), 409);
    return c.json(IntegrationsSchema.parse(await c.var.market.settings()));
  });
  settings.delete('/:slot', async (c) => {
    const slot = c.req.param('slot');
    const input = VersionInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success || (slot !== 'candidate' && slot !== 'active'))
      return c.json(failure('INVALID_INPUT'), 400);
    if (!(await c.var.market.remove(slot, input.data.version)))
      return c.json(failure('CONFLICT'), 409);
    return c.json(IntegrationsSchema.parse(await c.var.market.settings()));
  });

  const market = new Hono<PrivateEnv>();
  market.get('/', async (c) => {
    const input = SymbolsInputSchema.safeParse({ symbols: c.req.query('symbols')?.split(',') });
    if (!input.success) return c.json(failure('INVALID_INPUT'), 400);
    return c.json(
      MarketDataSchema.parse(await c.var.market.data([...new Set(input.data.symbols)])),
    );
  });
  market.post('/refresh', async (c) => {
    const input = SymbolsInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json(failure('INVALID_INPUT'), 400);
    return c.json(
      MarketDataSchema.parse(await c.var.market.refresh([...new Set(input.data.symbols)])),
    );
  });

  const protect = (routes: Hono<PrivateEnv>) =>
    new Hono<PrivateEnv>().route('/', app).route('/', routes);
  return { settings: protect(settings), market: protect(market) };
}
