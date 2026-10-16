import { check, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { repairStageEnum, repairStatusEnum } from './enums.js';
import { id, sameSiteId, timestamps } from './common.js';
import { items } from './inventory.js';
import { requests } from './requests.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const repairRecords = pgTable('repair_records', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  ticketNumber: varchar('ticket_number', { length: 80 }).notNull(),
  requestId: uuid('request_id'),
  customerName: varchar('customer_name', { length: 180 }),
  device: varchar('device', { length: 240 }).notNull(),
  fault: text('fault').notNull(),
  stage: repairStageEnum('stage').notNull().default('diagnosis'),
  status: repairStatusEnum('status').notNull().default('open'),
  technicianId: uuid('technician_id').references(() => users.id, { onDelete: 'set null' }),
  partsCost: numeric('parts_cost', { precision: 14, scale: 2 }).notNull().default('0'),
  labourCost: numeric('labour_cost', { precision: 14, scale: 2 }).notNull().default('0'),
  metadata: jsonb('metadata').notNull().default({}),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  sameSiteId('repair_records_site_id_uq', table),
  unique('repair_records_site_ticket_uq').on(table.siteId, table.ticketNumber),
  foreignKey({
    name: 'repair_records_request_same_site_fk',
    columns: [table.siteId, table.requestId],
    foreignColumns: [requests.siteId, requests.id],
  }).onDelete('restrict'),
  check('repair_records_parts_cost_nonnegative_ck', sql`${table.partsCost} >= 0`),
  check('repair_records_labour_cost_nonnegative_ck', sql`${table.labourCost} >= 0`),
  index('repair_records_site_status_idx').on(table.siteId, table.status),
]);

export const repairParts = pgTable('repair_parts', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  repairRecordId: uuid('repair_record_id').notNull(),
  itemId: uuid('item_id'),
  description: varchar('description', { length: 240 }),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 14, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('repair_parts_site_id_uq', table),
  foreignKey({
    name: 'repair_parts_record_same_site_fk',
    columns: [table.siteId, table.repairRecordId],
    foreignColumns: [repairRecords.siteId, repairRecords.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'repair_parts_item_same_site_fk',
    columns: [table.siteId, table.itemId],
    foreignColumns: [items.siteId, items.id],
  }).onDelete('restrict'),
  check('repair_parts_quantity_positive_ck', sql`${table.quantity} > 0`),
  check('repair_parts_unit_cost_nonnegative_ck', sql`${table.unitCost} >= 0`),
  index('repair_parts_site_record_idx').on(table.siteId, table.repairRecordId),
]);
