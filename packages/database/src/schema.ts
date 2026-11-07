import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// M0 migration seam only. Ledger tables and constraints belong to M1.
export const schemaVersions = sqliteTable('schema_versions', {
  version: integer('version').primaryKey(),
  label: text('label').notNull(),
});
