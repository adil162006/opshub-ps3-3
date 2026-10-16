import {
  addRepairPart,
  createRepair,
  deleteRepair,
  getMembership,
  getRepair,
  listRepairs,
  rank,
  removeRepairPart,
  updateRepair,
} from './repairs.service.js';

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

// ---- GET /api/sites/:siteId/repairs or /api/:siteId/repairs ----
export async function listRepairsHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const { stage, status } = req.query;
    const rows = await listRepairs(req.params.siteId, { stage, status });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

// ---- GET /api/sites/:siteId/repairs/:id or /api/:siteId/repairs/:id ----
export async function getRepairHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const row = await getRepair(req.params.siteId, id);
    if (!row) {
      return res.status(404).json({ error: 'Repair record not found' });
    }

    return res.json(row);
  } catch (err) {
    return next(err);
  }
}

// ---- POST /api/sites/:siteId/repairs or /api/:siteId/repairs ----
export async function createRepairHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;

    if (req.body.requestId && !validUuid(req.body.requestId)) {
      return res.status(400).json({ error: 'requestId must be a valid UUID' });
    }

    const created = await createRepair(req.params.siteId, req.body, req.user.id);
    return res.status(201).json(created);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// ---- PUT /api/sites/:siteId/repairs/:id or /api/:siteId/repairs/:id ----
export async function updateRepairHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const updated = await updateRepair(req.params.siteId, id, req.body, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Repair record not found' });
    }

    return res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// ---- DELETE /api/sites/:siteId/repairs/:id or /api/:siteId/repairs/:id ----
export async function deleteRepairHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 3);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const result = await deleteRepair(req.params.siteId, id);
    if (!result) {
      return res.status(404).json({ error: 'Repair record not found' });
    }

    return res.json({ deleted: result.id });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// ---- POST /api/sites/:siteId/repairs/:id/parts ----
export async function addRepairPartHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'repair record id must be a valid UUID' });
    }

    const part = await addRepairPart(req.params.siteId, id, req.body);
    return res.status(201).json(part);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// ---- DELETE /api/sites/:siteId/repairs/:id/parts/:partId ----
export async function removeRepairPartHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;

    const { id, partId } = req.params;
    if (!validUuid(id) || !validUuid(partId)) {
      return res.status(400).json({ error: 'id and partId must be valid UUIDs' });
    }

    const result = await removeRepairPart(req.params.siteId, id, partId);
    if (!result) {
      return res.status(404).json({ error: 'Repair part not found' });
    }

    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}
