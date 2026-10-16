import { check, foreignKey, index, numeric, pgTable, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { assignmentStatusEnum } from './enums.js';
import { id, sameSiteId, timestamps } from './common.js';
import { items } from './inventory.js';
import { requestItems, requests } from './requests.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const assignments = pgTable('assignments', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  assignmentNumber: varchar('assignment_number', { length: 80 }).notNull(),
  requestId: uuid('request_id'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  status: assignmentStatusEnum('status').notNull().default('issued'),
  notes: text('notes'),
  ...timestamps(),
}, (table) => [
  sameSiteId('assignments_site_id_uq', table),
  unique('assignments_site_number_uq').on(table.siteId, table.assignmentNumber),
  foreignKey({
    name: 'assignments_request_same_site_fk',
    columns: [table.siteId, table.requestId],
    foreignColumns: [requests.siteId, requests.id],
  }).onDelete('restrict'),
  index('assignments_site_status_idx').on(table.siteId, table.status),
]);

export const assignmentItems = pgTable('assignment_items', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  assignmentId: uuid('assignment_id').notNull(),
  requestItemId: uuid('request_item_id'),
  itemId: uuid('item_id').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  remainingQuantity: numeric('remaining_quantity', { precision: 14, scale: 3 }).notNull(),
  ...timestamps(),
}, (table) => [
  sameSiteId('assignment_items_site_id_uq', table),
  foreignKey({
    name: 'assignment_items_assignment_same_site_fk',
    columns: [table.siteId, table.assignmentId],
    foreignColumns: [assignments.siteId, assignments.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'assignment_items_request_item_same_site_fk',
    columns: [table.siteId, table.requestItemId],
    foreignColumns: [requestItems.siteId, requestItems.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'assignment_items_item_same_site_fk',
    columns: [table.siteId, table.itemId],
    foreignColumns: [items.siteId, items.id],
  }).onDelete('restrict'),
  check('assignment_items_quantity_positive_ck', sql`${table.quantity} > 0`),
  check('assignment_items_remaining_range_ck', sql`${table.remainingQuantity} >= 0 AND ${table.remainingQuantity} <= ${table.quantity}`),
  index('assignment_items_site_assignment_idx').on(table.siteId, table.assignmentId),
]);
