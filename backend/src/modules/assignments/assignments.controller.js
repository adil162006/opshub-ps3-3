import { getMembership, rank, listAssignments, getAssignment, createAssignment, updateAssignment } from './assignments.service.js';

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

export async function listAssignmentsHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const rows = await listAssignments(req.params.siteId, req.user.id);
    return res.json(rows);
  } catch (err) { return next(err); }
}

export async function getAssignmentHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await getAssignment(req.params.siteId, req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Assignment not found' });
    return res.json(row);
  } catch (err) { return next(err); }
}

export async function createAssignmentHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    const result = await createAssignment(req.params.siteId, req.body || {}, req.user.id);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

export async function updateAssignmentHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await updateAssignment(req.params.siteId, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Assignment not found' });
    return res.json(row);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}
