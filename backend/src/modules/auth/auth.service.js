import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { siteMembers, sites, users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import { generateToken } from '../../lib/jwt.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

/** Authenticate an existing global administrator and issue a server-signed token. */
export async function loginGlobalAdmin(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    passwordHash: users.passwordHash,
    isHubAdmin: users.isHubAdmin,
    isActive: users.isActive,
  }).from(users).where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);

  if (!user || !user.isActive || !user.isHubAdmin || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }

  const token = generateToken({ sub: user.id, role: 'Admin', isHubAdmin: true });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isHubAdmin: true,
      role: 'Admin',
    },
  };
}

/** Return the authenticated profile and every site the user can access from the hub. */
export async function getCurrentUser(userId) {
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    isHubAdmin: users.isHubAdmin,
    isActive: users.isActive,
  }).from(users).where(sql` ${users.id} = ${userId} `).limit(1);
  if (!user?.isActive) throw new AppError(401, 'Authenticated user is unavailable');

  const siteRows = user.isHubAdmin
    ? await db.select({ id: sites.id, slug: sites.slug, name: sites.name, description: sites.description })
      .from(sites).orderBy(sites.name)
    : await db.select({ id: sites.id, slug: sites.slug, name: sites.name, description: sites.description, role: siteMembers.role })
      .from(siteMembers).innerJoin(sites, sql`${sites.id} = ${siteMembers.siteId}`)
      .where(sql`${siteMembers.userId} = ${userId}`).orderBy(sites.name);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isHubAdmin: user.isHubAdmin,
    },
    sites: siteRows.map((site) => ({ ...site, role: user.isHubAdmin ? 'Admin' : site.role })),
  };
}
