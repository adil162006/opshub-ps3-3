import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { approvalDecisionEnum, siteRoleEnum } from './enums.js';
import { id, sameSiteId, timestamps } from './common.js';
import { requests } from './requests.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const approvals = pgTable('approvals', {
  id: id(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  step: integer('step').notNull(),
  requiredRole: siteRoleEnum('required_role').notNull().default('Manager'),
  decision: approvalDecisionEnum('decision').notNull().default('pending'),
  decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  comment: text('comment'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  sameSiteId('approvals_site_id_uq', table),
  foreignKey({
    name: 'approvals_request_same_site_fk',
    columns: [table.siteId, table.requestId],
    foreignColumns: [requests.siteId, requests.id],
  }).onDelete('cascade'),
  unique('approvals_request_step_uq').on(table.siteId, table.requestId, table.step),
  check('approvals_step_nonnegative_ck', sql`${table.step} >= 0`),
  index('approvals_site_decision_idx').on(table.siteId, table.decision),
]);
