import { env, exports } from 'cloudflare:workers';
import { applyD1Migrations, reset } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, schemaVersions } from '@portfolio/database';

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('local Workers runtime', () => {
  it('runs health through the actual Worker entry point', async () => {
    const response = await exports.default.fetch('https://local.test/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('applies the foundation SQL and accesses D1 through Drizzle', async () => {
    const database = createDatabase(env.DB);
    await database.insert(schemaVersions).values({ version: 0, label: 'M0 foundation' });
    expect(await database.select().from(schemaVersions)).toEqual([
      { version: 0, label: 'M0 foundation' },
    ]);
    await expect(
      database.insert(schemaVersions).values({ version: 0, label: 'duplicate' }),
    ).rejects.toThrow();
  });
});
