import {
  listUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
} from './users.service.js';

export async function getUsers(_req, res, next) {
  try {
    const data = await listUsers();
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function postUser(req, res, next) {
  try {
    const data = await createUser(req.body, req.user.id);
    return res.status(201).json(data);
  } catch (error) {
    return next(error);
  }
}

export async function patchUserRole(req, res, next) {
  try {
    const data = await updateUserRole(req.params.id, req.body, req.user.id);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function patchUserStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    const data = await updateUserStatus(req.params.id, Boolean(isActive), req.user.id);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}
