import { ApiError } from '../../lib/ApiError.js';
import { decideRequest, listApprovalHistory } from './approvals.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function checkRequest(req) {
  if (!UUID.test(req.params.siteId || '')) throw new ApiError(400, 'siteId must be a valid UUID');
}

export async function listApprovalsHandler(req, res) {
  checkRequest(req);
  res.json(await listApprovalHistory(req.params.siteId, req.user.id));
}

export async function decideApprovalHandler(req, res) {
  checkRequest(req);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(422, 'A JSON request body is required');
  res.status(201).json(await decideRequest(req.params.siteId, req.user.id, req.body));
}
