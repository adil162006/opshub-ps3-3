import { and, eq, inArray } from 'drizzle-orm';
import { modules, siteMembers, siteModules, sites, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';

const ROLE_RANK = { Member: 1, Manager: 2, Admin: 3 };
const MODULE_ALIASES = { users: 'user_mgmt' };

export async function getSiteContext(database, siteId, actorId, requiredModules = []) {
  const [actor] = await database.select({
    isHubAdmin: users.isHubAdmin,
    isActive: users.isActive,
  }).from(users).where(eq(users.id, actorId)).limit(1);
  if (!actor?.isActive) throw new ApiError(401, 'Authenticated user is unavailable');

  const [site] = await database.select({ id: sites.id, status: sites.status })
    .from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new ApiError(404, 'Site not found');
  if (site.status !== 'active') throw new ApiError(403, 'Site is not active');

  let role = 'Admin';
  if (!actor.isHubAdmin) {
    const [membership] = await database.select({ role: siteMembers.role })
      .from(siteMembers)
      .where(and(eq(siteMembers.siteId, site.id), eq(siteMembers.userId, actorId)))
      .limit(1);
    if (!membership) throw new ApiError(403, 'You do not have access to this site');
    role = membership.role;
  }

  const enabledModules = requiredModules.map((key) => MODULE_ALIASES[key] || key);
  if (enabledModules.length) {
    const rows = await database.select({ key: modules.key })
      .from(siteModules)
      .innerJoin(modules, eq(siteModules.moduleId, modules.id))
      .where(and(
        eq(siteModules.siteId, site.id),
        eq(siteModules.enabled, true),
        inArray(modules.key, enabledModules),
      ));
    if (new Set(rows.map(({ key }) => key)).size !== new Set(enabledModules).size) {
      throw new ApiError(403, 'Required module is not enabled for this site');
    }
  }

  return { siteId: site.id, role };
}

export function requireRole(role, minimumRole) {
  const minimumRank = ROLE_RANK[minimumRole];
  if (!minimumRank) throw new ApiError(500, 'Invalid minimum site role configuration');
  if ((ROLE_RANK[role] || 0) < minimumRank) {
    throw new ApiError(403, `Requires at least ${minimumRole} role for this site`);
  }
}
