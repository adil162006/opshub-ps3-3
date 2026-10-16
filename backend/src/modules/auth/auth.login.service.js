import bcrypt from 'bcryptjs';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { siteMembers, sites, users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import { generateToken } from '../../lib/jwt.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

/** Authenticate a regular user account and return the sites available to it. */
export async function loginUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    passwordHash: users.passwordHash,
    isHubAdmin: users.isHubAdmin,
    isActive: users.isActive,
  }).from(users).where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);

  if (!user || !user.isActive || user.isHubAdmin || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }

  const memberships = await db.select({
    id: sites.id,
    slug: sites.slug,
    name: sites.name,
    description: sites.description,
    role: siteMembers.role,
  }).from(siteMembers)
    .innerJoin(sites, eq(sites.id, siteMembers.siteId))
    .where(eq(siteMembers.userId, user.id))
    .orderBy(asc(sites.name));

  if (!memberships.length) throw new AppError(403, 'This account does not belong to any site');

  const token = generateToken({ sub: user.id, isHubAdmin: false });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isHubAdmin: false,
    },
    sites: memberships,
  };
}
