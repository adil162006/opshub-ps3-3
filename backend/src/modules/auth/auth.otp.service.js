import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import { verifyToken } from '../../lib/jwt.js';
import mm from '../../lib/minimoth.js';
import { createAuthenticatedSession } from './auth.login.service.js';

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const OTP_PATTERN = /^\d{4,8}$/;

function getVerificationUser(verificationToken) {
  if (typeof verificationToken !== 'string' || !verificationToken.trim()) {
    throw new AppError(401, 'A valid phone verification session is required');
  }

  let payload;
  try {
    payload = verifyToken(verificationToken);
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      throw new AppError(401, 'Phone verification session is invalid or expired');
    }
    throw error;
  }
  if (!payload || typeof payload !== 'object'
    || payload.purpose !== 'phone-verification' || typeof payload.sub !== 'string') {
    throw new AppError(401, 'Phone verification session is invalid');
  }
  return payload.sub;
}

function validatePhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== 'string' || !PHONE_PATTERN.test(phoneNumber.trim())) {
    throw new AppError(422, 'A valid phone number in international format is required');
  }
  return phoneNumber.trim();
}

async function getUnverifiedUser(userId) {
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    isHubAdmin: users.isHubAdmin,
    isActive: users.isActive,
    isVerified: users.isVerified,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isActive) throw new AppError(401, 'Phone verification session is no longer valid');
  if (user.isVerified) throw new AppError(409, 'This account is already phone verified');
  return user;
}

export async function sendPhoneOtp(verificationToken, phoneNumber) {
  const userId = getVerificationUser(verificationToken);
  await getUnverifiedUser(userId);
  const phone = validatePhoneNumber(phoneNumber);

  try {
    await mm.otp.send({ phone });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'Could not send the phone verification code. Please try again.');
  }
  return { sent: true };
}

export async function verifyPhoneOtp(verificationToken, phoneNumber, otp) {
  const userId = getVerificationUser(verificationToken);
  const user = await getUnverifiedUser(userId);
  const phone = validatePhoneNumber(phoneNumber);
  if (typeof otp !== 'string' || !OTP_PATTERN.test(otp.trim())) {
    throw new AppError(422, 'Enter the verification code');
  }

  let result;
  try {
    result = await mm.otp.verify({ phone, otp: otp.trim() });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'Could not verify the phone code. Please try again.');
  }
  if (!result?.valid) throw new AppError(400, result?.code || 'INVALID_OTP');

  const [verified] = await db.update(users)
    .set({ phoneNumber: phone, isVerified: true, updatedAt: new Date() })
    .where(and(eq(users.id, user.id), eq(users.isVerified, false), eq(users.isActive, true)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isHubAdmin: users.isHubAdmin,
    });
  if (!verified) throw new AppError(409, 'This account could not be verified. Please sign in again.');
  return createAuthenticatedSession(verified);
}
