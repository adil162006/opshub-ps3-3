import { getMembership, rank, listConsumption, recordConsumption } from './consumption.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (v) => UUID_RE.test(v);

async function resolveRole(req, res, minRank) {
  const { siteId } = req.params;
  if (!validUuid(siteId)) { res.status(400).json({ error: 'siteId must be a valid UUID' }); return null; }
  const role = await getMembership(siteId, req.user.id);
  if (!role) { res.status(403).json({ error: 'You do not have access to this site' }); return null; }
  if (rank(role) < minRank) { res.status(403).json({ error: `Requires rank ${minRank} (you are ${role})` }); return null; }
  return role;
}

export async function listConsumptionHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const { assignmentItemId } = req.query;
    if (assignmentItemId && !validUuid(assignmentItemId)) {
      return res.status(400).json({ error: 'assignmentItemId must be a valid UUID' });
    }
    const rows = await listConsumption(req.params.siteId, assignmentItemId || null, req.user.id);
    return res.json(rows);
  } catch (err) { return next(err); }
}

export async function recordConsumptionHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const body = req.body || {};
    const assignmentItemId = body.assignmentItemId;
    const assignmentId = body.assignmentId;
    const quantity = body.qty ?? body.quantity;
    if ((!assignmentItemId && !assignmentId) || quantity === undefined) {
      return res.status(422).json({ error: 'assignmentId and qty are required' });
    }
    if (assignmentItemId && !validUuid(assignmentItemId)) {
      return res.status(400).json({ error: 'assignmentItemId must be a valid UUID' });
    }
    if (assignmentId && !validUuid(assignmentId)) return res.status(400).json({ error: 'assignmentId must be a valid UUID' });
    const result = await recordConsumption(req.params.siteId, body, req.user.id);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}
