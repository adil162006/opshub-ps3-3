import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { siteMembers, sites, users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import { generatePhoneVerificationToken, generateToken } from '../../lib/jwt.js';
import { comparePassword } from '../../lib/password.js';

const INVALID_CREDENTIALS = 'Invalid email or password';

/** Create an authenticated session for a verified account. */
export async function createAuthenticatedSession(user) {
  const memberships = user.isHubAdmin
    ? await db.select({
      id: sites.id,
      slug: sites.slug,
      name: sites.name,
      description: sites.description,
    }).from(sites).orderBy(asc(sites.name))
    : await db.select({
      id: sites.id,
      slug: sites.slug,
      name: sites.name,
      description: sites.description,
      role: siteMembers.role,
    }).from(siteMembers)
      .innerJoin(sites, eq(sites.id, siteMembers.siteId))
      .where(eq(siteMembers.userId, user.id))
      .orderBy(asc(sites.name));

  if (!user.isHubAdmin && !memberships.length) {
    throw new AppError(403, 'This account does not belong to any site');
  }

  const token = generateToken({
    sub: user.id,
    isHubAdmin: user.isHubAdmin,
    ...(user.isHubAdmin ? { role: 'Admin' } : {}),
  });
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isHubAdmin: user.isHubAdmin,
      ...(user.isHubAdmin ? { role: 'Admin' } : {}),
    },
    sites: memberships.map((site) => ({
      ...site,
      role: user.isHubAdmin ? 'Admin' : site.role,
    })),
  };
}

/** Authenticate any account type and return its accessible sites. */
export async function loginAccount(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    passwordHash: users.passwordHash,
    isHubAdmin: users.isHubAdmin,
    isActive: users.isActive,
    isVerified: users.isVerified,
  }).from(users).where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);

  if (!user || !user.isActive || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }
  if (!user.isVerified) {
    const verificationToken = generatePhoneVerificationToken(user.id);
    throw new AppError(403, 'Phone verification is required before signing in', [
      { code: 'PHONE_NOT_VERIFIED', verificationToken },
    ]);
  }

  return createAuthenticatedSession(user);
}
