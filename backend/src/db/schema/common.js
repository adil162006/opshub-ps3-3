import { timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid('id').defaultRandom().primaryKey();
export const siteId = () => uuid('site_id').notNull();
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const sameSiteId = (name, table) => unique(name).on(table.siteId, table.id);
