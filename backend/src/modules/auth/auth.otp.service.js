import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/index.js';
import { ApiError as AppError } from '../../lib/ApiError.js';
import mm from '../../lib/minimoth.js';

export async function verifyPhoneOtp(phoneNumber, otp) {
  if (typeof phoneNumber !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phoneNumber.trim())) {
    throw new AppError(422, 'A valid phone number in international format is required');
  }
  if (typeof otp !== 'string' || !/^\d{4,8}$/.test(otp.trim())) {
    throw new AppError(422, 'Enter the verification code');
  }

  const phone = phoneNumber.trim();
  const result = await mm.otp.verify({ phone, otp: otp.trim() });
  if (!result?.valid) throw new AppError(400, result?.code || 'INVALID_OTP');

  const [verified] = await db.update(users)
    .set({ isVerified: true, updatedAt: new Date() })
    .where(eq(users.phoneNumber, phone))
    .returning({ id: users.id });
  if (!verified) throw new AppError(404, 'No account is registered with this phone number');
  return { verified: true };
}
