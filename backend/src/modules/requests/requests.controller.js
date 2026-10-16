import { ApiError } from '../../lib/ApiError.js';
import { createRequest, deleteRequest, listRequests, updateRequest } from './requests.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const checkParams = (req, requireId = false) => {
  if (!UUID.test(req.params.siteId || '')) throw new ApiError(400, 'siteId must be a valid UUID');
  if (requireId && !UUID.test(req.params.id || '')) throw new ApiError(400, 'id must be a valid UUID');
};
const checkBody = (req) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(422, 'A JSON request body is required');
};

export async function listRequestsHandler(req, res) {
  checkParams(req);
  res.json(await listRequests(req.params.siteId, req.user.id));
}

export async function createRequestHandler(req, res) {
  checkParams(req);
  checkBody(req);
  res.status(201).json(await createRequest(req.params.siteId, req.user.id, req.body));
}

export async function updateRequestHandler(req, res) {
  checkParams(req, true);
  checkBody(req);
  res.json(await updateRequest(req.params.siteId, req.params.id, req.user.id, req.body));
}

export async function deleteRequestHandler(req, res) {
  checkParams(req, true);
  res.json(await deleteRequest(req.params.siteId, req.params.id, req.user.id));
}
