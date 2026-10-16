import { check, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { excelJobStatusEnum, excelJobTypeEnum } from './enums.js';
import { id, sameSiteId, timestamps } from './common.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const excelJobs = pgTable('excel_jobs', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  type: excelJobTypeEnum('type').notNull(),
  status: excelJobStatusEnum('status').notNull().default('queued'),
  resource: varchar('resource', { length: 100 }).notNull(),
  fileName: varchar('file_name', { length: 255 }),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  rowCount: integer('row_count'),
  error: text('error'),
  result: jsonb('result').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  sameSiteId('excel_jobs_site_id_uq', table),
  check('excel_jobs_row_count_nonnegative_ck', sql`${table.rowCount} IS NULL OR ${table.rowCount} >= 0`),
  check('excel_jobs_result_object_ck', sql`jsonb_typeof(${table.result}) = 'object'`),
  index('excel_jobs_site_created_idx').on(table.siteId, table.createdAt),
]);
