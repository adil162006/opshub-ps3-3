import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { siteMembers, sites, users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import { MIN_PASSWORD_LENGTH } from '../../lib/password.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Register a global administrator account. */
export async function signupGlobalAdmin({ name, email, password }) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedName || normalizedName.length > 160) {
    throw new AppError(422, 'name is required and must be at most 160 characters');
  }
  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 320) {
    throw new AppError(422, 'A valid email is required');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(422, `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);
  if (existingUser) throw new AppError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [user] = await db.insert(users).values({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      isHubAdmin: true,
      isActive: true,
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isHubAdmin: users.isHubAdmin,
    });
    return { user };
  } catch (error) {
    if (error.code === '23505') throw new AppError(409, 'Email already registered');
    throw error;
  }
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
