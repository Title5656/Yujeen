type Slot = 'candidate' | 'active';
type Provider = 'alpaca' | 'frankfurter';
type Status = 'OK' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'AUTH_FAILED';
const alpacaDayLimit = 96;
const alpacaMonthLimit = 2976;

export interface SealedCredential {
  version: string;
  key_version: number;
  nonce: string;
  ciphertext: string;
  tested_at: string | null;
}

export function createMarketRepository(db: D1Database) {
  const statement = (sql: string, ...args: (number | string | null)[]) =>
    db.prepare(sql).bind(...args);
  return {
    async slots() {
      const { results } = await db
        .prepare('SELECT slot, version, tested_at FROM market_credentials')
        .all<{ slot: Slot; version: string; tested_at: string | null }>();
      const slot = (name: Slot) => {
        const result = results.find((row) => row.slot === name);
        return result ? { version: result.version, testedAt: result.tested_at } : null;
      };
      return { candidate: slot('candidate'), active: slot('active') };
    },
    credential(slot: Slot) {
      return statement(
        'SELECT version, key_version, nonce, ciphertext, tested_at FROM market_credentials WHERE slot = ?',
        slot,
      ).first<SealedCredential>();
    },
    async save(record: SealedCredential) {
      await statement(
        `INSERT INTO market_credentials (slot, version, key_version, nonce, ciphertext)
        VALUES ('candidate', ?, ?, ?, ?) ON CONFLICT (slot) DO UPDATE SET
        version = excluded.version, key_version = excluded.key_version, nonce = excluded.nonce,
        ciphertext = excluded.ciphertext, tested_at = NULL`,
        record.version,
        record.key_version,
        record.nonce,
        record.ciphertext,
      ).run();
    },
    async markTested(version: string, testedAt: string | null) {
      const result = await statement(
        "UPDATE market_credentials SET tested_at = ? WHERE slot = 'candidate' AND version = ?",
        testedAt,
        version,
      ).run();
      return result.meta.changes === 1;
    },
    async activate(version: string, earliest: string) {
      const tested = "slot = 'candidate' AND version = ? AND tested_at >= ?";
      const [, update] = await db.batch([
        statement(
          `DELETE FROM market_credentials WHERE slot = 'active'
          AND EXISTS (SELECT 1 FROM market_credentials WHERE ${tested})`,
          version,
          earliest,
        ),
        statement(
          `UPDATE market_credentials SET slot = 'active' WHERE ${tested}`,
          version,
          earliest,
        ),
      ]);
      return update?.meta.changes === 1;
    },
    async remove(slot: Slot, version: string) {
      const result = await statement(
        'DELETE FROM market_credentials WHERE slot = ? AND version = ?',
        slot,
        version,
      ).run();
      return result.meta.changes === 1;
    },
    async acquire(provider: Provider, now: number, refresh: boolean) {
      const day = new Date(now).toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      const lease = crypto.randomUUID();
      const dayLimit = provider === 'alpaca' ? alpacaDayLimit : 1;
      const monthLimit = provider === 'alpaca' ? alpacaMonthLimit : 31;
      const dailyRefresh = refresh && provider === 'frankfurter';
      const refreshAt = dailyRefresh ? now + 86_400_000 : 0;
      const granted = await statement(
        `INSERT INTO market_budget
        (provider, day, day_count, month, month_count, next_at, refresh_at, lease, lease_until, status)
        VALUES (?, ?, 1, ?, 1, ?, ?, ?, ?, 'UNAVAILABLE')
        ON CONFLICT (provider) DO UPDATE SET
          day_count = CASE WHEN day = excluded.day THEN day_count + 1 ELSE 1 END,
          month_count = CASE WHEN month = excluded.month THEN month_count + 1 ELSE 1 END,
          day = excluded.day, month = excluded.month, next_at = excluded.next_at,
          refresh_at = MAX(refresh_at, excluded.refresh_at), lease = excluded.lease, lease_until = excluded.lease_until
        WHERE next_at <= ? AND lease_until <= ? AND (? = 0 OR refresh_at <= ?)
          AND (day <> excluded.day OR day_count < ?)
          AND (month <> excluded.month OR month_count < ?)
        RETURNING lease`,
        provider,
        day,
        month,
        now + 60_000,
        refreshAt,
        lease,
        now + 20_000,
        now,
        now,
        dailyRefresh ? 1 : 0,
        now,
        dayLimit,
        monthLimit,
      ).first<string>('lease');
      return granted;
    },
    async quoteWait(now: number) {
      const row = await db
        .prepare(
          "SELECT day, day_count, month, month_count, next_at, refresh_at, lease_until FROM market_budget WHERE provider = 'alpaca'",
        )
        .first<{
          day: string;
          day_count: number;
          month: string;
          month_count: number;
          next_at: number;
          refresh_at: number;
          lease_until: number;
        }>();
      if (!row) return { reason: 'COOLDOWN' as const, until: now };
      const date = new Date(now);
      const day = date.toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      const until = Math.max(now, row.next_at, row.lease_until);
      if (row.month === month && row.month_count >= alpacaMonthLimit) {
        return {
          reason: 'MONTHLY_QUOTA' as const,
          until: Math.max(until, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
        };
      }
      if (row.day === day && row.day_count >= alpacaDayLimit) {
        return {
          reason: 'DAILY_QUOTA' as const,
          until: Math.max(until, Date.parse(day) + 86_400_000),
        };
      }
      // For Alpaca, finish records upstream backoff in both timestamps. Frankfurter uses
      // refresh_at for the daily refresh interval. Older Alpaca rows can also contain that interval.
      if (row.refresh_at > now && row.refresh_at === row.next_at) {
        return { reason: 'UPSTREAM_RATE_LIMIT' as const, until };
      }
      if (row.lease_until > now) return { reason: 'IN_PROGRESS' as const, until };
      return { reason: 'COOLDOWN' as const, until };
    },
    async finish(
      provider: Provider,
      lease: string,
      status: Status | null,
      now: number,
      retry: { at: number; rateLimited: boolean } | null,
      items: readonly { namespace: string; symbol: string; payload: string }[] = [],
      version: string | null = null,
    ) {
      const stillHeld =
        'SELECT 1 FROM market_budget WHERE provider = ? AND lease = ? AND lease_until > ?';
      await db.batch([
        ...items.map(({ namespace, symbol, payload }) =>
          statement(
            `INSERT INTO market_cache
          (namespace, symbol, payload, fetched_at) SELECT ?, ?, ?, ? WHERE EXISTS (${stillHeld})
          ON CONFLICT (namespace, symbol) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
            namespace,
            symbol,
            payload,
            now,
            provider,
            lease,
            now,
          ),
        ),
        statement(
          `UPDATE market_budget SET status = COALESCE(?, status),
          status_version = CASE WHEN ? IS NULL THEN status_version ELSE ? END,
          lease_until = 0, next_at = MAX(next_at, ?),
          refresh_at = CASE WHEN provider = 'alpaca' AND ? THEN ? ELSE refresh_at END
          WHERE provider = ? AND lease = ? AND lease_until > ?`,
          status,
          status,
          version,
          retry?.at ?? 0,
          retry?.rateLimited ? 1 : 0,
          retry?.at ?? 0,
          provider,
          lease,
          now,
        ),
        ...(items.length
          ? [statement('DELETE FROM market_cache WHERE fetched_at < ?', now - 7 * 86_400_000)]
          : []),
      ]);
    },
    async status(provider: Provider, version: string | null = null) {
      return (
        (await statement(
          'SELECT status FROM market_budget WHERE provider = ? AND status_version IS ?',
          provider,
          version,
        ).first<Status>('status')) ?? 'UNAVAILABLE'
      );
    },
    async cache(namespace: string, symbols: readonly string[]) {
      if (!symbols.length) return [];
      const result = await statement(
        `SELECT payload FROM market_cache WHERE namespace = ?
        AND symbol IN (${symbols.map(() => '?').join(', ')})`,
        namespace,
        ...symbols,
      ).all<{ payload: string }>();
      return result.results.map((row) => JSON.parse(row.payload) as unknown);
    },
  };
}

export type MarketRepository = ReturnType<typeof createMarketRepository>;
