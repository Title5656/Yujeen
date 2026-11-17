import { decodeBase64 } from '../lib/base64.js';

export interface InstallBindings {
  DB?: D1Database;
  APP_ORIGIN?: string;
  OWNER_EMAIL?: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  MASTER_ENCRYPTION_KEY?: string;
  ENABLE_ALPACA?: string;
  ENABLE_FRANKFURTER?: string;
}

export function installation(env: InstallBindings | undefined) {
  const db = env?.DB;
  const origin = env?.APP_ORIGIN;
  const owner = env?.OWNER_EMAIL?.trim().toLowerCase();
  const issuer = env?.ACCESS_ISSUER;
  const audience = env?.ACCESS_AUDIENCE;
  const key = env?.MASTER_ENCRYPTION_KEY;
  if (!db || !origin || !owner || !issuer || !audience || !key) return;
  if (
    !/^https:\/\/[a-z0-9.-]+$/.test(origin) ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner) ||
    !/^[a-zA-Z0-9_-]+$/.test(audience) ||
    !/^[A-Za-z0-9+/]{43}=$/.test(key)
  )
    return;
  const masterKey = decodeBase64(key);
  if (masterKey.length !== 32) return;
  return {
    db,
    origin,
    owner,
    issuer,
    audience,
    masterKey,
    alpaca: env.ENABLE_ALPACA === 'true',
    fx: env.ENABLE_FRANKFURTER === 'true',
  };
}

export type Installation = NonNullable<ReturnType<typeof installation>>;
