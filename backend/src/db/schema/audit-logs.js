import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, sameSiteId } from './common.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 120 }).notNull(),
  entityType: varchar('entity_type', { length: 120 }).notNull(),
  entityId: uuid('entity_id'),
  details: jsonb('details').notNull().default({}),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('audit_logs_site_id_uq', table),
  check('audit_logs_details_object_ck', sql`jsonb_typeof(${table.details}) = 'object'`),
  index('audit_logs_site_created_idx').on(table.siteId, table.createdAt),
  index('audit_logs_site_entity_idx').on(table.siteId, table.entityType, table.entityId),
]);
