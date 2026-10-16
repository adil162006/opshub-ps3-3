import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, siteMembers, auditLogs } from '../../db/schema/index.js';
import { hashPassword, comparePassword } from '../../lib/password.js';
import { generateToken } from '../../lib/jwt.js';
import { ApiError } from '../../lib/ApiError.js';

function validateSetupAdmin(data) {
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

  return { name, email, password };
}

function validateLogin(data) {
  const email = String(data?.email || '').trim().toLowerCase();
  const password = String(data?.password || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Invalid email address');
  }
  if (!password) {
    throw new ApiError(400, 'Password is required');
  }

  return { email, password };
}

export async function checkSetupStatus() {
  const [result] = await db
    .select({ count: sql`count(*)::int` })
    .from(users)
    .where(sql`${users.isHubAdmin} = true AND ${users.isActive} = true`);

  const existingAdminCount = result?.count || 0;
  return {
    setupRequired: existingAdminCount === 0,
    existingAdminCount,
  };
}

export async function registerFirstGlobalAdmin(data) {
  const parsed = validateSetupAdmin(data);
  const cleanEmail = parsed.email;

  return await db.transaction(async (tx) => {
    // Acquire PostgreSQL advisory xact lock to serialize concurrent setup calls
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('global_admin_setup'))`);

    // Verify under transaction lock that NO Global Admin exists
    const [adminCheck] = await tx
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(sql`${users.isHubAdmin} = true AND ${users.isActive} = true`);

    if (adminCheck?.count > 0) {
      throw new ApiError(403, 'First Global Admin setup has already been completed.');
    }

    // Check if email is already registered
    const [existingEmail] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${cleanEmail}`)
      .limit(1);

    if (existingEmail) {
      throw new ApiError(409, 'A user with this email address already exists.');
    }

    const passwordHash = await hashPassword(parsed.password);

    const [newAdmin] = await tx
      .insert(users)
      .values({
        name: parsed.name,
        email: cleanEmail,
        passwordHash,
        isHubAdmin: true,
        isActive: true,
      })
      .returning();

    // Record setup in audit log
    await tx.insert(auditLogs).values({
      userId: newAdmin.id,
      action: 'FIRST_GLOBAL_ADMIN_CREATED',
      entityType: 'USER',
      entityId: newAdmin.id,
      details: {
        email: cleanEmail,
        name: parsed.name,
        timestamp: new Date().toISOString(),
      },
    });

    const token = generateToken({
      sub: newAdmin.id,
      id: newAdmin.id,
      email: newAdmin.email,
      isHubAdmin: true,
      role: 'Admin',
    });

    return {
      token,
      user: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        isHubAdmin: true,
        role: 'Admin',
        memberships: {},
      },
    };
  });
}

export async function loginUser(data) {
  const parsed = validateLogin(data);
  const cleanEmail = parsed.email;

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${cleanEmail}`)
    .limit(1);

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await comparePassword(parsed.password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Fetch site memberships
  const memberships = await db
    .select({ siteId: siteMembers.siteId, role: siteMembers.role })
    .from(siteMembers)
    .where(eq(siteMembers.userId, user.id));

  const membershipsMap = Object.fromEntries(
    memberships.map((m) => [m.siteId, m.role])
  );

  const role = user.isHubAdmin ? 'Admin' : 'User';
  const token = generateToken({
    sub: user.id,
    id: user.id,
    email: user.email,
    isHubAdmin: user.isHubAdmin,
    role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      isHubAdmin: user.isHubAdmin,
      memberships: membershipsMap,
    },
  };
}

export async function getUserProfile(userId) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isHubAdmin: users.isHubAdmin,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new ApiError(404, 'User not found or inactive');
  }

  const memberships = await db
    .select({ siteId: siteMembers.siteId, role: siteMembers.role })
    .from(siteMembers)
    .where(eq(siteMembers.userId, user.id));

  const membershipsMap = Object.fromEntries(
    memberships.map((m) => [m.siteId, m.role])
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.isHubAdmin ? 'Admin' : 'User',
    isHubAdmin: user.isHubAdmin,
    memberships: membershipsMap,
    createdAt: user.createdAt,
  };
}
