import { foreignKey, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { deploymentActionEnum } from './enums.js';
import { sameSiteId } from './common.js';
import { siteVersions } from './site-versions.js';
import { sites } from './sites.js';
import { users } from './users.js';

export const deployments = pgTable('deployments', {
  id: uuid('id').defaultRandom().primaryKey(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  versionId: uuid('version_id').notNull(),
  action: deploymentActionEnum('action').notNull(),
  deployedBy: uuid('deployed_by').references(() => users.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  sameSiteId('deployments_site_id_uq', table),
  foreignKey({
    name: 'deployments_version_same_site_fk',
    columns: [table.siteId, table.versionId],
    foreignColumns: [siteVersions.siteId, siteVersions.id],
  }),
  index('deployments_site_created_idx').on(table.siteId, table.createdAt),
]);
