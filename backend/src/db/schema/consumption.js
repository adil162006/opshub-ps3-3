import { check, foreignKey, index, numeric, pgTable, date, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, sameSiteId } from './common.js';
import { assignmentItems } from './assignments.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const consumptionRecords = pgTable('consumption_records', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  assignmentItemId: uuid('assignment_item_id').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  consumedOn: date('consumed_on').notNull().defaultNow(),
  consumedBy: uuid('consumed_by').references(() => users.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('consumption_records_site_id_uq', table),
  foreignKey({
    name: 'consumption_records_assignment_item_same_site_fk',
    columns: [table.siteId, table.assignmentItemId],
    foreignColumns: [assignmentItems.siteId, assignmentItems.id],
  }).onDelete('restrict'),
  check('consumption_records_quantity_positive_ck', sql`${table.quantity} > 0`),
  index('consumption_records_site_assignment_item_idx').on(table.siteId, table.assignmentItemId),
]);
