import { check, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { priorityEnum, requestStatusEnum } from './enums.js';
import { id, sameSiteId, timestamps } from './common.js';
import { items } from './inventory.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const requests = pgTable('requests', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  requestNumber: varchar('request_number', { length: 80 }).notNull(),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  status: requestStatusEnum('status').notNull().default('pending'),
  priority: priorityEnum('priority').notNull().default('Normal'),
  currentStep: integer('current_step').notNull().default(0),
  team: varchar('team', { length: 180 }),
  notes: text('notes'),
  metadata: jsonb('metadata').notNull().default({}),
  ...timestamps(),
}, (table) => [
  sameSiteId('requests_site_id_uq', table),
  unique('requests_site_number_uq').on(table.siteId, table.requestNumber),
  check('requests_current_step_nonnegative_ck', sql`${table.currentStep} >= 0`),
  check('requests_metadata_object_ck', sql`jsonb_typeof(${table.metadata}) = 'object'`),
  index('requests_site_status_created_idx').on(table.siteId, table.status, table.createdAt),
]);

export const requestItems = pgTable('request_items', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  itemId: uuid('item_id'),
  description: varchar('description', { length: 240 }),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }),
  metadata: jsonb('metadata').notNull().default({}),
  ...timestamps(),
}, (table) => [
  sameSiteId('request_items_site_id_uq', table),
  foreignKey({
    name: 'request_items_request_same_site_fk',
    columns: [table.siteId, table.requestId],
    foreignColumns: [requests.siteId, requests.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'request_items_item_same_site_fk',
    columns: [table.siteId, table.itemId],
    foreignColumns: [items.siteId, items.id],
  }).onDelete('restrict'),
  check('request_items_quantity_positive_ck', sql`${table.quantity} > 0`),
  check('request_items_unit_price_nonnegative_ck', sql`${table.unitPrice} IS NULL OR ${table.unitPrice} >= 0`),
  check('request_items_metadata_object_ck', sql`jsonb_typeof(${table.metadata}) = 'object'`),
  index('request_items_site_request_idx').on(table.siteId, table.requestId),
]);
