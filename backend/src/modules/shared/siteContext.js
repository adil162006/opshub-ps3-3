import { and, eq } from 'drizzle-orm';
import { AppError } from '../../lib/AppError.js';
import { siteMembers, siteVersions, sites, users } from '../../db/schema/index.js';

export async function getSiteContext(executor, siteId, userId, requiredModules = []) {
  const [actor] = await executor.select({ id: users.id, name: users.name, isHubAdmin: users.isHubAdmin, isActive: users.isActive })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!actor?.isActive) throw new AppError(401, 'Authenticated user is unavailable');

  const [site] = await executor.select({ id: sites.id, liveVersionId: sites.liveVersionId })
    .from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new AppError(404, 'Site not found');

  let role = null;
  if (actor.isHubAdmin) role = 'Admin';
  else {
    const [membership] = await executor.select({ role: siteMembers.role }).from(siteMembers)
      .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
    role = membership?.role;
  }
  if (!role) throw new AppError(404, 'Site not found');

  const [version] = site.liveVersionId
    ? await executor.select({ config: siteVersions.config }).from(siteVersions)
      .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId))).limit(1)
    : [];
  const config = version?.config || { nodes: [], edges: [] };
  const nodes = config.nodes || [];
  const types = new Set(nodes.map((node) => node?.data?.type).filter(Boolean));
  for (const moduleType of requiredModules) {
    if (!types.has(moduleType)) throw new AppError(404, `${moduleType} module is not enabled on this site`);
  }
  return { actor, role, config, types };
}

export function requireRole(role, minimum) {
  const rank = { Member: 1, Manager: 2, Admin: 3 };
  if ((rank[role] || 0) < rank[minimum]) throw new AppError(403, `Requires ${minimum} role (you are ${role})`);
}

export function configNode(config, type) {
  return config.nodes?.find((node) => node?.data?.type === type) || null;
import { siteMembers, siteVersions, sites, users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';

const roleRank = { Public: 0, Member: 1, Manager: 2, Admin: 3 };
const moduleNames = {
  approval: 'Approval',
  assignment: 'Assignment',
  consumption: 'Consumption',
  inventory: 'Inventory',
  repair: 'PCB Repair',
  reports: 'Reports',
  request: 'Request',
  returns: 'Return Management',
  users: 'User Management',
};

export function configNode(config, type) {
  return config?.nodes?.find((node) => node?.data?.type === type) ?? null;
}

export async function getSiteContext(db, siteId, userId, requiredModules = []) {
  const [site] = await db.select({ id: sites.id, liveVersionId: sites.liveVersionId })
    .from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new AppError(404, 'Site not found');

  const [user] = await db.select({ isHubAdmin: users.isHubAdmin, isActive: users.isActive })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isActive) throw new AppError(401, 'Authenticated user is unavailable');

  let role = 'Admin';
  if (!user.isHubAdmin) {
    const [membership] = await db.select({ role: siteMembers.role }).from(siteMembers)
      .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
    if (!membership) throw new AppError(403, 'You do not have access to this site');
    role = membership.role;
  }

  let config = { nodes: [] };
  if (site.liveVersionId) {
    const [version] = await db.select({ config: siteVersions.config }).from(siteVersions)
      .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId))).limit(1);
    config = version?.config || config;
  }

  for (const type of requiredModules) {
    if (!configNode(config, type)) {
      throw new AppError(404, `${moduleNames[type] || type} module not enabled`);
    }
  }

  return { site, role, config };
}

export function requireRole(role, minimumRole) {
  if ((roleRank[role] ?? -1) < (roleRank[minimumRole] ?? Number.POSITIVE_INFINITY)) {
    throw new AppError(403, `Requires ${minimumRole} role for this site`);
  }
}
