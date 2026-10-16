import { and, eq } from 'drizzle-orm';
import { siteMembers, siteVersions, sites, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';

const moduleNames = {
  approval: 'Approval', assignment: 'Assignment', consumption: 'Consumption', inventory: 'Inventory',
  repair: 'PCB Repair', reports: 'Reports', request: 'Request', returns: 'Return Management', users: 'User Management',
};

export function configNode(config, type) {
  return config?.nodes?.find((node) => node?.data?.type === type) ?? null;
}

export async function getSiteContext(executor, siteId, userId, requiredModules = []) {
  const [actor] = await executor.select({ id: users.id, name: users.name, isHubAdmin: users.isHubAdmin, isActive: users.isActive })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!actor?.isActive) throw new ApiError(401, 'Authenticated user is unavailable');

  const [site] = await executor.select({ id: sites.id, liveVersionId: sites.liveVersionId })
    .from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new ApiError(404, 'Site not found');

  let role = null;
  if (actor.isHubAdmin) role = 'Admin';
  else {
    const [membership] = await executor.select({ role: siteMembers.role }).from(siteMembers)
      .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
    role = membership?.role;
  }
  if (!role) throw new ApiError(404, 'Site not found');

  const [version] = site.liveVersionId
    ? await executor.select({ config: siteVersions.config }).from(siteVersions)
      .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId))).limit(1)
    : [];
  const config = version?.config || { nodes: [], edges: [] };
  for (const type of requiredModules) {
    if (!configNode(config, type)) throw new ApiError(404, `${moduleNames[type] || type} module not enabled`);
  }
  return { actor, site, role, config };
}

export function requireRole(role, minimumRole) {
  const rank = { Public: 0, Member: 1, Manager: 2, Admin: 3 };
  if ((rank[role] ?? 0) < (rank[minimumRole] ?? Number.POSITIVE_INFINITY)) {
    throw new ApiError(403, `Requires ${minimumRole} role for this site`);
  }
}
