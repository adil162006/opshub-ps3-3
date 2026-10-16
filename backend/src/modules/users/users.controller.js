import { AppError } from '../../lib/AppError.js';
import { addSiteUser, createUserByGlobalAdmin, listSiteUsers, listUsersForGlobalAdmin } from './users.service.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

function checkSiteId(req) {
  if (!isUuid(req.params.siteId)) throw new AppError(400, 'siteId must be a valid UUID');
}

export async function getUsers(req, res) {
  res.json(await listUsersForGlobalAdmin(req.user.id, req.query));
}

export async function postUser(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(422, 'A JSON request body is required');
  }
  res.status(201).json(await createUserByGlobalAdmin(req.user.id, req.body));
}

export async function getSiteUsers(req, res) {
  checkSiteId(req);
  res.json(await listSiteUsers(req.params.siteId, req.user.id));
}

export async function postSiteUser(req, res) {
  checkSiteId(req);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(422, 'A JSON request body is required');
  }
  res.status(201).json(await addSiteUser(req.params.siteId, req.user.id, req.body));
}
