import { check, foreignKey, pgTable, unique, uuid, varchar, text, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { siteStatusEnum } from './enums.js';
import { timestamps } from './common.js';
import { users } from './users.js';
import { siteVersions } from './site-versions.js';

export const sites = pgTable('sites', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull(),
  name: varchar('name', { length: 180 }).notNull(),
  description: text('description'),
  theme: jsonb('theme').notNull().default({
    primaryColor: '#2563eb',
    backgroundColor: '#f8fafc',
    sidebarColor: '#0f172a',
    textColor: '#1e293b',
    fontFamily: 'Inter',
    borderRadius: '8px',
  }),
  status: siteStatusEnum('status').notNull().default('active'),
  liveVersionId: uuid('live_version_id'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps(),
}, (table) => [
  unique('sites_slug_uq').on(table.slug),
  check('sites_theme_object_ck', sql`jsonb_typeof(${table.theme}) = 'object'`),
  foreignKey({
    name: 'sites_live_version_same_site_fk',
    columns: [table.id, table.liveVersionId],
    foreignColumns: [siteVersions.siteId, siteVersions.id],
  }).onDelete('restrict'),
]);
