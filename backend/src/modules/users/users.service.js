import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, siteMembers, auditLogs, sites } from '../../db/schema/index.js';
import { hashPassword } from '../../lib/password.js';
import { ApiError } from '../../lib/ApiError.js';

function validateCreateUser(data) {
  const name = String(data?.name || '').trim();
  const email = String(data?.email || '').trim().toLowerCase();
  const password = String(data?.password || '');

  if (!name || name.length < 2) {
    throw new ApiError(400, 'Name must be at least 2 characters');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Invalid email address');
  }
  if (!password || password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  return {
    name,
    email,
    password,
    isGlobalAdmin: Boolean(data?.isGlobalAdmin),
    role: data?.role,
    memberships: data?.memberships && typeof data.memberships === 'object' ? data.memberships : {},
  };
}

async function getSiteIdMap(tx) {
  const allSites = await tx.select({ id: sites.id, slug: sites.slug }).from(sites);
  const map = new Map();
  for (const s of allSites) {
    map.set(s.id, s.id);
    map.set(s.slug, s.id);
  }
  return map;
}

export async function listUsers() {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isHubAdmin: users.isHubAdmin,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  const allMemberships = await db
    .select({
      userId: siteMembers.userId,
      siteId: siteMembers.siteId,
      role: siteMembers.role,
    })
    .from(siteMembers);

  const membershipMap = {};
  for (const m of allMemberships) {
    if (!membershipMap[m.userId]) {
      membershipMap[m.userId] = {};
    }
    membershipMap[m.userId][m.siteId] = m.role;
  }

  return allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.isHubAdmin ? 'Admin' : 'User',
    isHubAdmin: u.isHubAdmin,
    isActive: u.isActive,
    memberships: membershipMap[u.id] || {},
    createdAt: u.createdAt,
  }));
}

export async function createUser(data, actorId) {
  const parsed = validateCreateUser(data);
  const cleanEmail = parsed.email;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${cleanEmail}`)
    .limit(1);

  if (existing) {
    throw new ApiError(409, 'A user with this email address already exists');
  }

  const isGlobalAdmin = parsed.isGlobalAdmin || parsed.role === 'Admin';
  const passwordHash = await hashPassword(parsed.password);

  return await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        name: parsed.name,
        email: cleanEmail,
        passwordHash,
        isHubAdmin: isGlobalAdmin,
        isActive: true,
      })
      .returning();

    const siteIdMap = await getSiteIdMap(tx);
    const siteEntries = Object.entries(parsed.memberships || {});
    for (const [key, siteRole] of siteEntries) {
      const resolvedSiteId = siteIdMap.get(key);
      if (resolvedSiteId && ['Member', 'Manager', 'Admin'].includes(siteRole)) {
        await tx.insert(siteMembers).values({
          siteId: resolvedSiteId,
          userId: newUser.id,
          role: siteRole,
        });
      }
    }

    // Log administrative action
    await tx.insert(auditLogs).values({
      userId: actorId,
      action: isGlobalAdmin ? 'GLOBAL_ADMIN_CREATED' : 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser.id,
      details: {
        email: cleanEmail,
        isGlobalAdmin,
        memberships: parsed.memberships,
      },
    });

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.isHubAdmin ? 'Admin' : 'User',
      isHubAdmin: newUser.isHubAdmin,
      isActive: newUser.isActive,
      memberships: parsed.memberships || {},
      createdAt: newUser.createdAt,
    };
  });
}

export async function updateUserRole(targetUserId, updates, actorId) {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  let newIsHubAdmin = target.isHubAdmin;
  if (updates.isGlobalAdmin !== undefined) {
    newIsHubAdmin = Boolean(updates.isGlobalAdmin);
  } else if (updates.role !== undefined) {
    newIsHubAdmin = updates.role === 'Admin' || updates.role === 'GLOBAL_ADMIN';
  }

  // SAFEGUARD: Lockout prevention
  if (target.isHubAdmin && !newIsHubAdmin) {
    const [adminCountResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(sql`${users.isHubAdmin} = true AND ${users.isActive} = true AND ${users.id} != ${targetUserId}`);

    if (!adminCountResult || adminCountResult.count < 1) {
      throw new ApiError(
        409,
        'Cannot remove privileges from the last active Global Administrator. Promote another active Global Admin first.'
      );
    }
  }

  return await db.transaction(async (tx) => {
    const userUpdates = {
      isHubAdmin: newIsHubAdmin,
      updatedAt: new Date(),
    };

    if (updates.name) userUpdates.name = updates.name.trim();

    await tx.update(users).set(userUpdates).where(eq(users.id, targetUserId));

    const siteIdMap = await getSiteIdMap(tx);

    if (updates.memberships !== undefined) {
      await tx.delete(siteMembers).where(eq(siteMembers.userId, targetUserId));

      const siteEntries = Object.entries(updates.memberships || {});
      for (const [key, siteRole] of siteEntries) {
        const resolvedSiteId = siteIdMap.get(key);
        if (resolvedSiteId && ['Member', 'Manager', 'Admin'].includes(siteRole)) {
          await tx.insert(siteMembers).values({
            siteId: resolvedSiteId,
            userId: targetUserId,
            role: siteRole,
          });
        }
      }
    }

    // Log role change in audit logs
    await tx.insert(auditLogs).values({
      userId: actorId,
      action: newIsHubAdmin !== target.isHubAdmin
        ? (newIsHubAdmin ? 'PROMOTED_TO_GLOBAL_ADMIN' : 'REVOKED_GLOBAL_ADMIN')
        : 'SITE_ROLES_UPDATED',
      entityType: 'USER',
      entityId: targetUserId,
      details: {
        previousIsHubAdmin: target.isHubAdmin,
        newIsHubAdmin,
        memberships: updates.memberships,
      },
    });

    const currentMemberships = await tx
      .select({ siteId: siteMembers.siteId, role: siteMembers.role })
      .from(siteMembers)
      .where(eq(siteMembers.userId, targetUserId));

    const finalMemberships = Object.fromEntries(
      currentMemberships.map((m) => [m.siteId, m.role])
    );

    return {
      id: target.id,
      name: userUpdates.name || target.name,
      email: target.email,
      role: newIsHubAdmin ? 'Admin' : 'User',
      isHubAdmin: newIsHubAdmin,
      isActive: target.isActive,
      memberships: finalMemberships,
    };
  });
}

export async function updateUserStatus(targetUserId, isActive, actorId) {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  // SAFEGUARD: Cannot deactivate the last active Global Admin
  if (target.isHubAdmin && !isActive) {
    const [adminCountResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(sql`${users.isHubAdmin} = true AND ${users.isActive} = true AND ${users.id} != ${targetUserId}`);

    if (!adminCountResult || adminCountResult.count < 1) {
      throw new ApiError(
        409,
        'Cannot deactivate the last active Global Administrator.'
      );
    }
  }

  return await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));

    await tx.insert(auditLogs).values({
      userId: actorId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: targetUserId,
      details: { isActive },
    });

    return {
      id: target.id,
      email: target.email,
      isActive,
    };
  });
}
