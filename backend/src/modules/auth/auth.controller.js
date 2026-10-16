import { ApiError as AppError } from '../../lib/ApiError.js';
import { getCurrentUser, loginGlobalAdmin } from './auth.service.js';
import { loginUser } from './auth.login.service.js';

function validateCredentials(req) {
  const email = req.body?.email;
  const password = req.body?.password;
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw new AppError(422, 'email and password are required');
  }
  return { email, password };
}

export async function loginGlobalAdminController(req, res) {
  const { email, password } = validateCredentials(req);
  res.json(await loginGlobalAdmin(email, password));
}

export async function loginUserController(req, res) {
  const { email, password } = validateCredentials(req);
  res.json(await loginUser(email, password));
}

export async function getMeController(req, res) {
  res.json(await getCurrentUser(req.user.id));
}
