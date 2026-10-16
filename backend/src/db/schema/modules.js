import { boolean, check, jsonb, pgTable, primaryKey, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { moduleKeyEnum } from './enums.js';
import { timestamps } from './common.js';
import { sites } from './sites.js';

export const modules = pgTable('modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: moduleKeyEnum('key').notNull(),
  name: varchar('name', { length: 180 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 80 }),
  ...timestamps(),
}, (table) => [
  unique('modules_key_uq').on(table.key),
]);

export const siteModules = pgTable('site_modules', {
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'restrict' }),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').notNull().default({}),
  ...timestamps(),
}, (table) => [
  primaryKey({ name: 'site_modules_pk', columns: [table.siteId, table.moduleId] }),
  check('site_modules_config_object_ck', sql`jsonb_typeof(${table.config}) = 'object'`),
]);
