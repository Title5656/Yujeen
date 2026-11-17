import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  AlpacaCredentialsSchema,
  IntegrationsSchema,
  MarketDataSchema,
  SymbolsInputSchema,
  VersionInputSchema,
} from '@portfolio/contracts';
import { installation, ownerVerifier } from '../../middleware/owner.js';
import type { FetchUpstream, InstallBindings } from '../../middleware/owner.js';
import { marketService } from './service.js';

export interface MarketDependencies {
  fetch?: FetchUpstream;
  now?: () => number;
}
type PrivateEnv = {
  Bindings: InstallBindings;
  Variables: {
    market: ReturnType<typeof marketService>;
    alpacaEnabled: boolean;
  };
};

const messages = {
  INVALID_INPUT: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
  UNAUTHENTICATED: 'กรุณาเข้าสู่ระบบผ่าน Cloudflare Access',
  FORBIDDEN: 'ไม่อนุญาตให้เข้าถึงจากบัญชีหรือเว็บไซต์นี้',
  NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าชุดติดตั้งหรือยังไม่เปิดบริการนี้',
  CONFLICT: 'การตั้งค่าเปลี่ยนไปหรือยังไม่ได้ผ่านการทดสอบ',
  RATE_LIMITED: 'ครบโควตาหรือกำลังรอรอบถัดไป',
  AUTH_FAILED: 'ผู้ให้บริการปฏิเสธ API Key หรือสิทธิ์เข้าถึง feed',
  UNAVAILABLE: 'ยังเชื่อมต่อผู้ให้บริการไม่ได้',
} as const;
const failure = (code: keyof typeof messages) => ({ error: { code, message: messages[code] } });

export function marketRoutes(deps: MarketDependencies) {
  const app = new Hono<PrivateEnv>();
  const now = deps.now ?? Date.now;
  const fetchUpstream: FetchUpstream = deps.fetch ?? ((url, init) => fetch(url, init));
  const verify = ownerVerifier(fetchUpstream);

  app.use('*', async (c, next) => {
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
    c.set('market', marketService(config, fetchUpstream, now));
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
