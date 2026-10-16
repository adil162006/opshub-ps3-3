import { ApiError } from '../../lib/ApiError.js';
import { createReturn, listReturns } from './returns.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function checkSite(req) {
  if (!UUID.test(req.params.siteId || '')) throw new ApiError(400, 'siteId must be a valid UUID');
}

export async function listReturnsHandler(req, res) {
  checkSite(req);
  res.json(await listReturns(req.params.siteId, req.user.id));
}

export async function createReturnHandler(req, res) {
  checkSite(req);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(422, 'A JSON request body is required');
  res.status(201).json(await createReturn(req.params.siteId, req.user.id, req.body));
}
