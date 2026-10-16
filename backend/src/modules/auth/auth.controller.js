import { ApiError as AppError } from '../../lib/ApiError.js';
import { getCurrentUser, signupGlobalAdmin } from './auth.service.js';
import { loginAccount } from './auth.login.service.js';

const AUTH_COOKIE = 'token';

function authCookieOptions() {
  const sameSite = (process.env.AUTH_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(sameSite)) {
    throw new Error('AUTH_COOKIE_SAME_SITE must be "strict", "lax", or "none".');
  }

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/api',
  };
}

function sendLoginResponse(res, { token, user, ...response }) {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
  res.set('Cache-Control', 'no-store');
  res.json({
    ...response,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      ...(user.isHubAdmin !== undefined ? { isHubAdmin: user.isHubAdmin } : {}),
      ...(user.role !== undefined ? { role: user.role } : {}),
    },
  });
}

function validateCredentials(req) {
  const email = req.body?.email;
  const password = req.body?.password;
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw new AppError(422, 'email and password are required');
  }
  return { email, password };
}

export async function signupGlobalAdminController(req, res) {
  const result = await signupGlobalAdmin({
    name: req.body?.name,
    email: req.body?.email,
    password: req.body?.password,
  });
  res.set('Cache-Control', 'no-store');
  res.status(201).json(result);
}

export async function loginController(req, res) {
  const { email, password } = validateCredentials(req);
  sendLoginResponse(res, await loginAccount(email, password));
}

export async function getMeController(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json(await getCurrentUser(req.user.id));
}

export function logoutController(_req, res) {
  res.clearCookie(AUTH_COOKIE, authCookieOptions());
  res.status(204).end();
}
