import { ApiError } from '../../lib/ApiError.js';
import { deleteRepair, listRepairs, startRepair, updateRepair } from './repairs.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function check(req, needsId = false) {
  if (!UUID.test(req.params.siteId || '')) throw new ApiError(400, 'siteId must be a valid UUID');
  if (needsId && !UUID.test(req.params.id || '')) throw new ApiError(400, 'id must be a valid UUID');
}

export async function listRepairsHandler(req, res) {
  check(req);
  res.json(await listRepairs(req.params.siteId, req.user.id));
}

export async function createRepairHandler(req, res) {
  check(req);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(422, 'A JSON request body is required');
  res.status(201).json(await startRepair(req.params.siteId, req.user.id, req.body));
}

export async function updateRepairHandler(req, res) {
  check(req, true);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(422, 'A JSON request body is required');
  res.json(await updateRepair(req.params.siteId, req.params.id, req.user.id, req.body));
}

export async function deleteRepairHandler(req, res) {
  check(req, true);
  res.json(await deleteRepair(req.params.siteId, req.params.id, req.user.id));
}
