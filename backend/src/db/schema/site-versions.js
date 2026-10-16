import { check, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { sites } from './sites.js';
import { users } from './users.js';

export const siteVersions = pgTable('site_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  config: jsonb('config').notNull(),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('site_versions_site_version_uq').on(table.siteId, table.version),
  unique('site_versions_site_id_uq').on(table.siteId, table.id),
  check('site_versions_version_positive_ck', sql`${table.version} > 0`),
  check('site_versions_config_object_ck', sql`jsonb_typeof(${table.config}) = 'object'`),
]);
