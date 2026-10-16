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
    primaryColor: '#4f46e5',
    backgroundColor: '#0b1020',
    sidebarColor: '#131c2e',
    cardColor: '#131c2e',
    textColor: '#e5e7eb',
    fontFamily: 'Inter',
    borderRadius: '10px',
    mode: 'dark',
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
