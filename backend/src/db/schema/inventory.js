import { boolean, check, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { stockMovementTypeEnum } from './enums.js';
import { id, sameSiteId } from './common.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const categories = pgTable('categories', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('categories_site_id_uq', table),
  unique('categories_site_name_uq').on(table.siteId, table.name),
  index('categories_site_idx').on(table.siteId),
]);

export const items = pgTable('items', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 120 }).notNull(),
  name: varchar('name', { length: 240 }).notNull(),
  description: text('description'),
  categoryId: uuid('category_id'),
  unit: varchar('unit', { length: 40 }).notNull().default('each'),
  quantityOnHand: numeric('quantity_on_hand', { precision: 14, scale: 3 }).notNull().default('0'),
  reorderLevel: numeric('reorder_level', { precision: 14, scale: 3 }).notNull().default('0'),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull().default('0'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('items_site_id_uq', table),
  unique('items_site_sku_uq').on(table.siteId, table.sku),
  foreignKey({
    name: 'items_category_same_site_fk',
    columns: [table.siteId, table.categoryId],
    foreignColumns: [categories.siteId, categories.id],
  }).onDelete('restrict'),
  check('items_quantity_nonnegative_ck', sql`${table.quantityOnHand} >= 0`),
  check('items_reorder_nonnegative_ck', sql`${table.reorderLevel} >= 0`),
  check('items_unit_price_nonnegative_ck', sql`${table.unitPrice} >= 0`),
  check('items_metadata_object_ck', sql`jsonb_typeof(${table.metadata}) = 'object'`),
  index('items_site_name_idx').on(table.siteId, table.name),
]);

export const stockMovements = pgTable('stock_movements', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull(),
  movementType: stockMovementTypeEnum('movement_type').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 14, scale: 3 }),
  referenceType: varchar('reference_type', { length: 80 }),
  referenceId: uuid('reference_id'),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('stock_movements_site_id_uq', table),
  foreignKey({
    name: 'stock_movements_item_same_site_fk',
    columns: [table.siteId, table.itemId],
    foreignColumns: [items.siteId, items.id],
  }).onDelete('restrict'),
  check('stock_movements_quantity_positive_ck', sql`${table.quantity} > 0`),
  check('stock_movements_balance_nonnegative_ck', sql`${table.balanceAfter} IS NULL OR ${table.balanceAfter} >= 0`),
  index('stock_movements_site_item_created_idx').on(table.siteId, table.itemId, table.createdAt),
]);
