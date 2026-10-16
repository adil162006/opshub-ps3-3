import { ApiError as AppError } from '../../lib/ApiError.js';
import { listSiteUsers, listUsersForGlobalAdmin, manageUser } from './users.service.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

function checkSiteId(req) {
  if (!isUuid(req.params.siteId)) throw new AppError(400, 'siteId must be a valid UUID');
}

function checkUserId(req) {
  if (!isUuid(req.params.userId)) throw new AppError(400, 'userId must be a valid UUID');
}

function checkBody(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(422, 'A JSON request body is required');
  }
}

export async function getUsers(req, res) {
  res.json(await listUsersForGlobalAdmin(req.user.id, req.query));
}

export async function postUser(req, res) {
  checkBody(req);
  res.status(201).json(await manageUser({ actorId: req.user.id, action: 'add', scope: 'global', input: req.body }));
}

export async function putUser(req, res) {
  checkUserId(req);
  checkBody(req);
  res.json(await manageUser({ actorId: req.user.id, action: 'update', scope: 'global', userId: req.params.userId, input: req.body }));
}

export async function deleteUser(req, res) {
  checkUserId(req);
  res.json(await manageUser({ actorId: req.user.id, action: 'delete', scope: 'global', userId: req.params.userId }));
}

export async function getSiteUsers(req, res) {
  checkSiteId(req);
  res.json(await listSiteUsers(req.params.siteId, req.user.id));
}

export async function postSiteUser(req, res) {
  checkSiteId(req);
  checkBody(req);
  res.status(201).json(await manageUser({ actorId: req.user.id, action: 'add', scope: 'site', siteId: req.params.siteId, input: req.body }));
}

export async function putSiteUser(req, res) {
  checkSiteId(req);
  checkUserId(req);
  checkBody(req);
  res.json(await manageUser({ actorId: req.user.id, action: 'update', scope: 'site', siteId: req.params.siteId, userId: req.params.userId, input: req.body }));
}

export async function deleteSiteUser(req, res) {
  checkSiteId(req);
  checkUserId(req);
  res.json(await manageUser({ actorId: req.user.id, action: 'delete', scope: 'site', siteId: req.params.siteId, userId: req.params.userId }));
}
