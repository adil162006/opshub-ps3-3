import { boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { siteRoleEnum } from './enums.js';
import { sites } from './sites.js';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 24 }),
  isVerified: boolean('is_verified').notNull().default(false),
  passwordHash: text('password_hash').notNull(),
  isHubAdmin: boolean('is_hub_admin').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('users_email_uq').on(sql`lower(${table.email})`),
]);

export const siteMembers = pgTable('site_members', {
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: siteRoleEnum('role').notNull().default('Member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: 'site_members_pk', columns: [table.siteId, table.userId] }),
  index('site_members_user_idx').on(table.userId),
]);
