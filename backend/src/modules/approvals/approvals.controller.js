import {
  createApproval,
  getApproval,
  getMembership,
  listApprovals,
  rank,
} from './approvals.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

async function resolveRole(req, res, minRank) {
  const { siteId } = req.params;
  if (!validUuid(siteId)) {
    res.status(400).json({ error: 'siteId must be a valid UUID' });
    return null;
  }
  const role = await getMembership(siteId, req.user.id);
  if (!role) {
    res.status(403).json({ error: 'You do not have access to this site' });
    return null;
  }
  if (rank(role) < minRank) {
    res.status(403).json({ error: `Requires rank ${minRank} (you are ${role})` });
    return null;
  }
  return role;
}

// GET /api/sites/:siteId/approvals or /api/:siteId/approvals
export async function listApprovalsHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const rows = await listApprovals(req.params.siteId);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

// GET /api/sites/:siteId/approvals/:id or /api/:siteId/approvals/:id
export async function getApprovalHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const row = await getApproval(req.params.siteId, id);
    if (!row) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    return res.json(row);
  } catch (err) {
    return next(err);
  }
}

// POST /api/sites/:siteId/approvals or /api/:siteId/approvals
export async function createApprovalHandler(req, res, next) {
  try {
    const { siteId } = req.params;
    if (!validUuid(siteId)) {
      return res.status(400).json({ error: 'siteId must be a valid UUID' });
    }

    const { requestId } = req.body;
    if (!validUuid(requestId)) {
      return res.status(400).json({ error: 'requestId must be a valid UUID' });
    }

    const created = await createApproval(siteId, req.body, req.user.id);
    return res.status(201).json(created);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}
