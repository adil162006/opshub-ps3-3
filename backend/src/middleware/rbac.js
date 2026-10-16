import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { siteMembers, users, sites } from '../db/schema/index.js';
import { ApiError } from '../lib/ApiError.js';

const ROLE_RANK = {
  Public: 0,
  Member: 1,
  Manager: 2,
  Admin: 3,
};

export async function requireGlobalAdmin(req, _res, next) {
  try {
    if (!req.user || !req.user.id) {
      return next(new ApiError(401, 'Authentication required'));
    }

    // Always query database to verify actual, current Global Admin status
    const [u] = await db
      .select({
        id: users.id,
        isHubAdmin: users.isHubAdmin,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!u || !u.isActive) {
      return next(new ApiError(401, 'User account is inactive or not found'));
    }

    if (!u.isHubAdmin) {
      return next(new ApiError(403, 'Global Administrator access required'));
    }

    req.user.isHubAdmin = true;
    req.user.role = 'Admin';
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireSiteRole(minRole = 'Member') {
  const minRank = ROLE_RANK[minRole] ?? 1;

  return async (req, _res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(new ApiError(401, 'Authentication required'));
      }

      const siteId = req.params.siteId;
      if (!siteId) {
        return next(new ApiError(400, 'Site identifier is required'));
      }

      // Check user in database
      const [u] = await db
        .select({
          id: users.id,
          isHubAdmin: users.isHubAdmin,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!u || !u.isActive) {
        return next(new ApiError(401, 'User account is inactive or not found'));
      }

      // Global Admins bypass all site restrictions
      if (u.isHubAdmin) {
        req.user.isHubAdmin = true;
        req.user.siteRole = 'Admin';
        return next();
      }

      // Check site exists
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId);
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(isUuid ? eq(sites.id, siteId) : eq(sites.slug, siteId))
        .limit(1);

      if (!site) {
        return next(new ApiError(404, 'Site not found'));
      }

      // Check site membership
      const [membership] = await db
        .select({ role: siteMembers.role })
        .from(siteMembers)
        .where(and(eq(siteMembers.siteId, site.id), eq(siteMembers.userId, req.user.id)))
        .limit(1);

      if (!membership) {
        return next(new ApiError(403, 'You do not have access to this site'));
      }

      const userRank = ROLE_RANK[membership.role] ?? 0;
      if (userRank < minRank) {
        return next(new ApiError(403, `Requires at least ${minRole} role for this site`));
      }

      req.user.siteRole = membership.role;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
