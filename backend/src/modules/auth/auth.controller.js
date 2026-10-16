import {
  checkSetupStatus,
  registerFirstGlobalAdmin,
  loginUser,
  getUserProfile,
} from './auth.service.js';

export async function getSetupStatus(_req, res, next) {
  try {
    const status = await checkSetupStatus();
    return res.json(status);
  } catch (error) {
    return next(error);
  }
}

export async function setupFirstAdmin(req, res, next) {
  try {
    const result = await registerFirstGlobalAdmin(req.body);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const profile = await getUserProfile(req.user.id);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}
