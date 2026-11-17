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

export type FetchUpstream = (url: string, init?: RequestInit) => Promise<Response>;

export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
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
type AccessKey = JsonWebKey & { kid?: string };

export function ownerVerifier(fetchUpstream: FetchUpstream) {
  // One bounded entry per Worker isolate. A new key is picked up after cache expiry.
  let cached: { issuer: string; until: number; keys: AccessKey[] } | undefined;
  async function fetchKeys(issuer: string) {
    const response = await fetchUpstream(issuer + '/cdn-cgi/access/certs', {
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Access keys unavailable');
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== 'object' ||
      !('keys' in value) ||
      !Array.isArray(value.keys) ||
      value.keys.length > 16
    )
      throw new Error('Invalid Access keys');
    return value.keys.filter(
      (key): key is AccessKey =>
        key &&
        key.kty === 'RSA' &&
        typeof key.kid === 'string' &&
        typeof key.n === 'string' &&
        typeof key.e === 'string',
    );
  }
  async function keys(issuer: string, now: number) {
    if (cached?.issuer === issuer && now < cached.until) return cached.keys;
    const result = await fetchKeys(issuer);
    cached = { issuer, until: now + 5 * 60_000, keys: result };
    return result;
  }
  return async (
    input: string | undefined,
    config: Installation,
    now: number,
  ): Promise<200 | 401 | 403 | 503> => {
    if (!input || input.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(input)) return 401;
    const [header, payload, signature] = input.split('.');
    if (!header || !payload || !signature) return 401;
    let kid: string;
    let email: string;
    try {
      const parse = (part: string) =>
        JSON.parse(
          new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(decodeBase64(part)),
        );
      const head = parse(header);
      const claims = parse(payload);
      const timestamp = Math.floor(now / 1000);
      if (
        head?.alg !== 'RS256' ||
        typeof head.kid !== 'string' ||
        head.crit !== undefined ||
        claims?.iss !== config.issuer ||
        claims.type !== 'app' ||
        !Array.isArray(claims.aud) ||
        !claims.aud.includes(config.audience) ||
        !Number.isSafeInteger(claims.exp) ||
        claims.exp <= timestamp ||
        (claims.nbf !== undefined &&
          (!Number.isSafeInteger(claims.nbf) || claims.nbf > timestamp)) ||
        typeof claims.email !== 'string'
      )
        return 401;
      kid = head.kid;
      email = claims.email;
    } catch {
      return 401;
    }

    const jwks = await keys(config.issuer, now).catch(() => undefined);
    if (!jwks) return 503;
    const jwk = jwks.find((key) => key.kid === kid);
    if (!jwk) return 401;
    try {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        decodeBase64(signature),
        new TextEncoder().encode(header + '.' + payload),
      );
      if (!valid) return 401;
      return email.toLowerCase() === config.owner ? 200 : 403;
    } catch {
      return 401;
    }
  };
}
