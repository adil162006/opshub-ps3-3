import { AppError } from '../../lib/AppError.js';
import { decideApproval, listApprovals } from './approvals.service.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
function checkSiteId(req) {
  if (!isUuid(req.params.siteId)) throw new AppError(400, 'siteId must be a valid UUID');
}

export async function getApprovals(req, res) {
  checkSiteId(req);
  res.json(await listApprovals(req.params.siteId, req.user.id));
}
export async function postApproval(req, res) {
  checkSiteId(req);
  res.status(201).json(await decideApproval(req.params.siteId, req.user.id, req.body || {}));
}
