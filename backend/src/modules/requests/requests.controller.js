import { AppError } from '../../lib/AppError.js';
import { createRequest, deleteRequest, listRequests, updateRequest } from './requests.service.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
function checkIds(req) {
  if (!isUuid(req.params.siteId)) throw new AppError(400, 'siteId must be a valid UUID');
  if (req.params.id && !isUuid(req.params.id)) throw new AppError(400, 'request id must be a valid UUID');
}

export async function getRequests(req, res) {
  checkIds(req);
  res.json(await listRequests(req.params.siteId, req.user.id));
}
export async function postRequest(req, res) {
  checkIds(req);
  res.status(201).json(await createRequest(req.params.siteId, req.user.id, req.body || {}));
}
export async function putRequest(req, res) {
  checkIds(req);
  res.json(await updateRequest(req.params.siteId, req.user.id, req.params.id, req.body || {}));
}
export async function removeRequest(req, res) {
  checkIds(req);
  res.json(await deleteRequest(req.params.siteId, req.user.id, req.params.id));
}
