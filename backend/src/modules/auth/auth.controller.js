import { ApiError as AppError } from '../../lib/ApiError.js';
import { getCurrentUser, loginGlobalAdmin } from './auth.service.js';

export async function loginGlobalAdminController(req, res) {
  const email = req.body?.email;
  const password = req.body?.password;
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw new AppError(422, 'email and password are required');
  }
  res.json(await loginGlobalAdmin(email, password));
}

export async function getMeController(req, res) {
  res.json(await getCurrentUser(req.user.id));
}
