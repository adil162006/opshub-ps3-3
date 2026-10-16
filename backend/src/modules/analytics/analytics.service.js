import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  assignmentItems, assignments, categories, consumptionRecords, items,
  repairRecords, requests, returns, siteMembers, siteVersions, sites, users,
} from '../../db/schema/index.js';

const round = (value) => Math.round(Number(value || 0) * 100) / 100;
const rowsToSeries = (rows, nameKey, valueKey = 'value') => rows.map((row) => ({
  name: row[nameKey] || 'n/a', value: round(row[valueKey]),
}));
const enabledTypes = (config) => new Set((config?.nodes || []).map((node) => node?.data?.type).filter(Boolean));

async function readSiteConfig(siteId) {
  const [site] = await db.select({ liveVersionId: sites.liveVersionId })
    .from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) return null;
  if (!site.liveVersionId) return { nodes: [] };
  const [version] = await db.select({ config: siteVersions.config }).from(siteVersions)
    .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId))).limit(1);
  return version?.config || { nodes: [] };
}

/** Build per-site dashboard metrics from that site's enabled business modules. */
export async function getSiteAnalytics(siteId, userId) {
  const [membership] = await db.select({ role: siteMembers.role }).from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
  if (!membership) {
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) return null;
    const [user] = await db.select({ isHubAdmin: users.isHubAdmin }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.isHubAdmin) return { forbidden: true };
  }

  const config = await readSiteConfig(siteId);
  if (!config) return null;
  const modules = enabledTypes(config);
  if (!modules.has('analytics')) return { disabled: true };
  const data = {};

  if (modules.has('inventory')) {
    const inventoryRows = await db.select({
      sku: items.sku, name: items.name, qty: items.quantityOnHand,
      reorder: items.reorderLevel, price: items.unitPrice, category: categories.name,
    }).from(items).leftJoin(categories, and(eq(items.categoryId, categories.id), eq(items.siteId, categories.siteId)))
      .where(eq(items.siteId, siteId));
    const rows = inventoryRows.map((item) => ({ ...item, qty: Number(item.qty), reorder: Number(item.reorder),
      total: round(Number(item.qty) * Number(item.price)) }));
    const stockByCategory = new Map();
    rows.forEach((item) => {
      const key = item.category || 'n/a';
      stockByCategory.set(key, (stockByCategory.get(key) || 0) + item.total);
    });
    data.inventory = {
      stockValue: round(rows.reduce((sum, item) => sum + item.total, 0)),
      lowStockCount: rows.filter((item) => item.qty <= item.reorder).length,
      stockByCategory: [...stockByCategory].map(([name, value]) => ({ name, value: round(value) })),
      reorderLevels: [...rows].sort((a, b) => a.qty / (a.reorder || 1) - b.qty / (b.reorder || 1))
        .slice(0, 8).map(({ sku, qty, reorder }) => ({ sku, qty, reorder })),
      lowStock: rows.filter((item) => item.qty <= item.reorder)
        .map(({ sku, name, qty, reorder }) => ({ sku, name, qty, reorder })),
    };
  }

  if (modules.has('request')) {
    const result = await db.select({ name: requests.status, value: sql`count(*)::int` })
      .from(requests).where(eq(requests.siteId, siteId)).groupBy(requests.status);
    data.requests = { count: result.reduce((sum, row) => sum + Number(row.value), 0),
      pending: Number(result.find((row) => row.name === 'pending')?.value || 0), byStatus: rowsToSeries(result, 'name') };
  }

  if (modules.has('assignment')) {
    const result = await db.select({ name: sql`coalesce(${users.name}, 'Unassigned')`,
      issued: sql`coalesce(sum(${assignmentItems.quantity}), 0)`,
      remaining: sql`coalesce(sum(${assignmentItems.remainingQuantity}), 0)` })
      .from(assignments).innerJoin(assignmentItems,
        and(eq(assignmentItems.assignmentId, assignments.id), eq(assignmentItems.siteId, assignments.siteId)))
      .leftJoin(users, eq(users.id, assignments.assignedTo))
      .where(eq(assignments.siteId, siteId)).groupBy(users.name);
    data.assignments = result.map((row) => ({ name: row.name, issued: round(row.issued), remaining: round(row.remaining) }));
  }

  if (modules.has('consumption')) {
    const result = await db.select({ name: consumptionRecords.consumedOn, value: sql`sum(${consumptionRecords.quantity})` })
      .from(consumptionRecords).where(eq(consumptionRecords.siteId, siteId)).groupBy(consumptionRecords.consumedOn)
      .orderBy(consumptionRecords.consumedOn);
    data.consumption = rowsToSeries(result, 'name');
  }

  if (modules.has('repair')) {
    const [totals] = await db.select({ count: sql`count(*)::int`,
      revenue: sql`coalesce(sum(${repairRecords.partsCost} + ${repairRecords.labourCost}), 0)` })
      .from(repairRecords).where(eq(repairRecords.siteId, siteId));
    const stages = await db.select({ name: repairRecords.stage, value: sql`count(*)::int` })
      .from(repairRecords).where(eq(repairRecords.siteId, siteId)).groupBy(repairRecords.stage);
    data.repairs = { count: Number(totals.count), revenue: round(totals.revenue), byStage: rowsToSeries(stages, 'name') };
  }

  if (modules.has('returns')) {
    const [result] = await db.select({ count: sql`count(*)::int` }).from(returns).where(eq(returns.siteId, siteId));
    data.returns = { count: Number(result.count) };
  }
  return { siteId, modules: Object.fromEntries(['inventory', 'request', 'assignment', 'consumption', 'repair', 'returns']
    .map((key) => [key, modules.has(key)])), data };
}
