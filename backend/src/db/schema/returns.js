import { check, foreignKey, index, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { returnStatusEnum, returnTypeEnum } from './enums.js';
import { id, sameSiteId, timestamps } from './common.js';
import { assignmentItems, assignments } from './assignments.js';
import { items } from './inventory.js';
import { repairParts, repairRecords } from './repairs.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const returns = pgTable('returns', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  returnNumber: varchar('return_number', { length: 80 }).notNull(),
  type: returnTypeEnum('type').notNull(),
  status: returnStatusEnum('status').notNull().default('pending'),
  assignmentId: uuid('assignment_id'),
  repairRecordId: uuid('repair_record_id'),
  receivedBy: uuid('received_by').references(() => users.id, { onDelete: 'set null' }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  notes: text('notes'),
  ...timestamps(),
}, (table) => [
  sameSiteId('returns_site_id_uq', table),
  unique('returns_site_number_uq').on(table.siteId, table.returnNumber),
  foreignKey({
    name: 'returns_assignment_same_site_fk',
    columns: [table.siteId, table.assignmentId],
    foreignColumns: [assignments.siteId, assignments.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'returns_repair_record_same_site_fk',
    columns: [table.siteId, table.repairRecordId],
    foreignColumns: [repairRecords.siteId, repairRecords.id],
  }).onDelete('restrict'),
  check('returns_source_xor_ck', sql`(${table.assignmentId} IS NOT NULL)::int + (${table.repairRecordId} IS NOT NULL)::int = 1`),
  index('returns_site_status_idx').on(table.siteId, table.status),
]);

export const returnItems = pgTable('return_items', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  returnId: uuid('return_id').notNull(),
  itemId: uuid('item_id'),
  assignmentItemId: uuid('assignment_item_id'),
  repairPartId: uuid('repair_part_id'),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  condition: varchar('condition', { length: 80 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('return_items_site_id_uq', table),
  foreignKey({
    name: 'return_items_return_same_site_fk',
    columns: [table.siteId, table.returnId],
    foreignColumns: [returns.siteId, returns.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'return_items_item_same_site_fk',
    columns: [table.siteId, table.itemId],
    foreignColumns: [items.siteId, items.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'return_items_assignment_item_same_site_fk',
    columns: [table.siteId, table.assignmentItemId],
    foreignColumns: [assignmentItems.siteId, assignmentItems.id],
  }).onDelete('restrict'),
  foreignKey({
    name: 'return_items_repair_part_same_site_fk',
    columns: [table.siteId, table.repairPartId],
    foreignColumns: [repairParts.siteId, repairParts.id],
  }).onDelete('restrict'),
  check('return_items_quantity_positive_ck', sql`${table.quantity} > 0`),
  index('return_items_site_return_idx').on(table.siteId, table.returnId),
]);
