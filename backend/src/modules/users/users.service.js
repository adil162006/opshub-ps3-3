import bcrypt from 'bcryptjs';
import { and, asc, count, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { siteMembers, sites, users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import { sendAccountEmail } from '../../lib/accountEmail.js';
import { getSiteContext, requireRole } from '../shared/siteContext.js';

const SITE_ROLES = new Set(['Member', 'Manager', 'Admin']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

async function requireGlobalAdmin(userId) {
  const [actor] = await db.select({ id: users.id, isHubAdmin: users.isHubAdmin, isActive: users.isActive })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!actor?.isActive) throw new AppError(401, 'Authenticated user is unavailable');
  if (!actor.isHubAdmin) throw new AppError(403, 'Global admin access is required');
}

function normalizeMemberships(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new AppError(422, 'memberships must be an array of { siteId, role }');
  const seen = new Set();
  return input.map((membership) => {
    const { siteId, role } = membership || {};
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(siteId || '')) {
      throw new AppError(422, 'Each membership must include a valid siteId UUID');
    }
    if (!SITE_ROLES.has(role)) throw new AppError(422, 'Site role must be Member, Manager or Admin');
    if (seen.has(siteId)) throw new AppError(422, `Duplicate site membership: ${siteId}`);
    seen.add(siteId);
    return { siteId, role };
  });
}

/**
 * Single mutation entry point for account and site-membership changes.
 * Global scope manages accounts; site scope manages that site's membership.
 */
export async function manageUser({ actorId, action, scope = 'global', siteId, userId, input = {} }) {
  if (!['add', 'update', 'delete'].includes(action)) throw new AppError(400, 'Unsupported user action');
  if (!['global', 'site'].includes(scope)) throw new AppError(400, 'Unsupported user scope');

  if (scope === 'site') {
    const context = await getSiteContext(db, siteId, actorId, ['users']);
    requireRole(context.role, 'Admin');

    if (action === 'add') return createSiteUserImpl(siteId, actorId, input);
    const [membership] = await db.select({ userId: siteMembers.userId, role: siteMembers.role })
      .from(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
    if (!membership) throw new AppError(404, 'Site user not found');
    if (membership.role === 'Admin' && context.role !== 'Admin') throw new AppError(403, 'Only a site Admin can manage another Admin');
    if (action === 'update' && (input.role === undefined || input.role === null || input.role === '')) {
      await db.delete(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)));
      return { userId, siteId, removed: true };
    }
    if (action === 'delete') {
      await db.delete(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)));
      return { userId, siteId, removed: true };
    }
    const role = input.role;
    if (!SITE_ROLES.has(role)) throw new AppError(422, 'Site role must be Member, Manager or Admin');
    const [updated] = await db.update(siteMembers).set({ role })
      .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)))
      .returning({ userId: siteMembers.userId, siteId: siteMembers.siteId, role: siteMembers.role });
    return updated;
  }

  await requireGlobalAdmin(actorId);
  if (action === 'add') return createGlobalUserImpl(actorId, input);
  const [target] = await db.select({ id: users.id, name: users.name, email: users.email, isHubAdmin: users.isHubAdmin })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new AppError(404, 'User not found');
  if (target.isHubAdmin) throw new AppError(403, 'Global administrator accounts cannot be changed here');
  if (action === 'delete') {
    await db.delete(users).where(eq(users.id, userId));
    return { userId, deleted: true };
  }
  const updates = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 160) throw new AppError(422, 'name must be 1 to 160 characters');
    updates.name = input.name.trim();
  }
  if (input.email !== undefined) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (!EMAIL_PATTERN.test(email) || email.length > 320) throw new AppError(422, 'A valid email is required');
    updates.email = email;
  }
  if (input.password !== undefined) {
    if (typeof input.password !== 'string' || input.password.length < 12) throw new AppError(422, 'password must be at least 12 characters');
    updates.passwordHash = await bcrypt.hash(input.password, 12);
  }
  if (input.role !== undefined) {
    if (!['User', 'Admin'].includes(input.role)) throw new AppError(422, 'role must be User or Admin');
    updates.isHubAdmin = input.role === 'Admin';
  }
  const replaceMemberships = input.memberships !== undefined;
  const memberships = replaceMemberships ? normalizeMemberships(input.memberships) : null;
  if (updates.isHubAdmin && memberships?.length) throw new AppError(422, 'Global administrators do not use site memberships');
  if (!Object.keys(updates).length && !replaceMemberships) throw new AppError(422, 'Provide name, email, password, role or memberships to update');
  updates.updatedAt = new Date();
  if (replaceMemberships && memberships.length) {
    const foundSites = await db.select({ id: sites.id }).from(sites).where(inArray(sites.id, memberships.map((entry) => entry.siteId)));
    if (foundSites.length !== memberships.length) throw new AppError(422, 'One or more site IDs do not exist');
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(users).set(updates).where(eq(users.id, userId))
      .returning({ id: users.id, name: users.name, email: users.email, isHubAdmin: users.isHubAdmin, isActive: users.isActive });
    if (replaceMemberships) {
      await tx.delete(siteMembers).where(eq(siteMembers.userId, userId));
      if (memberships.length) await tx.insert(siteMembers).values(memberships.map(({ siteId, role }) => ({ siteId, userId, role })));
    } else if (updates.isHubAdmin === true) await tx.delete(siteMembers).where(eq(siteMembers.userId, userId));
    return updated;
  });
}

async function createGlobalUserImpl(actorId, input) {
  await requireGlobalAdmin(actorId);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!name || name.length > 160) throw new AppError(422, 'name is required and must be at most 160 characters');
  if (!EMAIL_PATTERN.test(email) || email.length > 320) throw new AppError(422, 'A valid email is required');

  const memberships = normalizeMemberships(input.memberships);
  const role = input.role || 'User';
  if (!['User', 'Admin'].includes(role)) throw new AppError(422, 'role must be User or Admin');
  if (role === 'Admin' && memberships.length) throw new AppError(422, 'Global administrators do not use site memberships');
  const password = input.password;
  if (typeof password !== 'string' || password.length < 12) throw new AppError(422, 'password must be at least 12 characters');

  if (memberships.length) {
    const siteIds = memberships.map((membership) => membership.siteId);
    const foundSites = await db.select({ id: sites.id, name: sites.name }).from(sites).where(inArray(sites.id, siteIds));
    if (foundSites.length !== siteIds.length) throw new AppError(422, 'One or more site IDs do not exist');
    const siteById = new Map(foundSites.map((site) => [site.id, site.name]));
    memberships.forEach((membership) => { membership.siteName = siteById.get(membership.siteId); });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({
      name, email, passwordHash, isHubAdmin: role === 'Admin', isActive: false,
    }).returning({ id: users.id, name: users.name, email: users.email, isHubAdmin: users.isHubAdmin });
    if (memberships.length) {
      await tx.insert(siteMembers).values(memberships.map(({ siteId, role }) => ({ siteId, userId: user.id, role })));
    }
    return [user];
  });

  try {
    await sendAccountEmail({ name, email, password, memberships });
    await db.update(users).set({ isActive: true, updatedAt: new Date() }).where(eq(users.id, created.id));
  } catch (error) {
    // Do not leave an unusable active account behind when the welcome message cannot be delivered.
    await db.delete(users).where(eq(users.id, created.id));
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'User was not created because the welcome email could not be sent');
  }

  return {
    user: { ...created, isActive: true },
    memberships: memberships.map(({ siteId, siteName, role }) => ({ siteId, siteName, role })),
    emailSent: true,
  };
}

// Compatibility exports keep existing route/controller call sites using the same mutation logic.
export const createUserByGlobalAdmin = (actorId, input) => manageUser({ actorId, action: 'add', scope: 'global', input });
export const addSiteUser = (siteId, actorId, input) => manageUser({ actorId, action: 'add', scope: 'site', siteId, input });

export async function listUsersForGlobalAdmin(actorId, query = {}) {
  await requireGlobalAdmin(actorId);
  const page = positiveInteger(query.page, 1);
  const limit = Math.min(100, positiveInteger(query.limit, 20));
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 120) : '';
  const filters = search ? ilike(users.name, `%${search.replace(/[%_]/g, '\\$&')}%`) : undefined;
  const where = filters ? and(filters) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email,
    isHubAdmin: users.isHubAdmin, isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users).where(where).orderBy(asc(users.name), asc(users.email))
    .limit(limit).offset((page - 1) * limit);

  const memberships = rows.length
    ? await db.select({ userId: siteMembers.userId, siteId: siteMembers.siteId, siteName: sites.name, role: siteMembers.role })
      .from(siteMembers).innerJoin(sites, eq(sites.id, siteMembers.siteId))
      .where(inArray(siteMembers.userId, rows.map((row) => row.id))).orderBy(asc(sites.name))
    : [];
  const rolesByUser = new Map(rows.map((row) => [row.id, []]));
  memberships.forEach((membership) => rolesByUser.get(membership.userId)?.push({
    siteId: membership.siteId, siteName: membership.siteName, role: membership.role,
  }));

  const totalUsers = Number(total);
  return {
    users: rows.map((row) => ({ ...row, memberships: rolesByUser.get(row.id) })),
    pagination: { page, limit, total: totalUsers, totalPages: Math.ceil(totalUsers / limit) },
  };
}

export async function listSiteUsers(siteId, actorId) {
  const context = await getSiteContext(db, siteId, actorId, ['users']);
  requireRole(context.role, 'Member');
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, isActive: users.isActive,
    siteId: siteMembers.siteId, role: siteMembers.role, joinedAt: siteMembers.createdAt,
  }).from(siteMembers).innerJoin(users, eq(users.id, siteMembers.userId))
    .where(eq(siteMembers.siteId, siteId)).orderBy(asc(users.name), asc(users.email));
  return { siteId, users: rows };
}

async function createSiteUserImpl(siteId, actorId, input) {
  const context = await getSiteContext(db, siteId, actorId, ['users']);
  requireRole(context.role, 'Admin');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!name || name.length > 160) throw new AppError(422, 'name is required and must be at most 160 characters');
  if (!EMAIL_PATTERN.test(email) || email.length > 320) throw new AppError(422, 'A valid email is required');

  const role = input.role || 'Member';
  if (!SITE_ROLES.has(role)) throw new AppError(422, 'Site role must be Member, Manager or Admin');
  const [site] = await db.select({ id: sites.id, name: sites.name }).from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new AppError(404, 'Site not found');

  const existingMatches = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${email}`).limit(1);
  let isNewUser = existingMatches.length === 0;
  let account;

  if (isNewUser) {
    const password = input.password;
    if (typeof password !== 'string' || password.length < 12) throw new AppError(422, 'A new account password must be at least 12 characters');
    const passwordHash = await bcrypt.hash(password, 12);
    account = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        name, email, passwordHash, isHubAdmin: false, isActive: false,
      }).returning({ id: users.id, name: users.name, email: users.email, isHubAdmin: users.isHubAdmin });
      await tx.insert(siteMembers).values({ siteId, userId: created.id, role });
      return created;
    });
  } else {
    account = await db.transaction(async (tx) => {
      const [found] = await tx.select({
        id: users.id, name: users.name, email: users.email,
        isHubAdmin: users.isHubAdmin, isActive: users.isActive,
      }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (!found) throw new AppError(409, 'User account changed while adding site access; retry the request');
      if (found.isHubAdmin) throw new AppError(409, 'This account is already a global administrator');
      if (!found.isActive) throw new AppError(409, 'This user account is inactive');
      const [membership] = await tx.select({ userId: siteMembers.userId }).from(siteMembers)
        .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, found.id))).limit(1);
      if (membership) throw new AppError(409, 'This user already belongs to the site');
      await tx.insert(siteMembers).values({ siteId, userId: found.id, role });
      return found;
    });
  }

  try {
    await sendAccountEmail({
      name: account.name, email: account.email, password: isNewUser ? input.password : null,
      memberships: [{ siteId, siteName: site.name, role }],
    });
    if (isNewUser) await db.update(users).set({ isActive: true, updatedAt: new Date() }).where(eq(users.id, account.id));
  } catch (error) {
    try {
      await db.delete(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, account.id)));
      if (isNewUser) await db.delete(users).where(eq(users.id, account.id));
    } catch (cleanupError) {
      console.error('Could not clean up site membership after email delivery failure:', cleanupError);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'User was not added because the welcome email could not be sent');
  }

  return {
    user: {
      id: account.id, name: account.name, email: account.email,
      isActive: true, siteId, role,
    },
    emailSent: true,
    initialPasswordSent: isNewUser,
  };
}
