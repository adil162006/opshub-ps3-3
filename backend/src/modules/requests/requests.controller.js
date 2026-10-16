import {
  createRequest,
  deleteRequest,
  getMembership,
  getRequest,
  listRequests,
  rank,
  updateRequest,
} from './requests.service.js';

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

// GET /api/sites/:siteId/requests or /api/:siteId/requests
export async function listRequestsHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const { status, priority } = req.query;
    const rows = await listRequests(req.params.siteId, { status, priority });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

// GET /api/sites/:siteId/requests/:id or /api/:siteId/requests/:id
export async function getRequestHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const row = await getRequest(req.params.siteId, id);
    if (!row) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.json(row);
  } catch (err) {
    return next(err);
  }
}

// POST /api/sites/:siteId/requests or /api/:siteId/requests
export async function createRequestHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;

    const created = await createRequest(req.params.siteId, req.body, req.user.id);
    return res.status(201).json(created);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// PUT /api/sites/:siteId/requests/:id or /api/:siteId/requests/:id
export async function updateRequestHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const updated = await updateRequest(req.params.siteId, id, req.body, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

// DELETE /api/sites/:siteId/requests/:id or /api/:siteId/requests/:id
export async function deleteRequestHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 3);
    if (!role) return;

    const { id } = req.params;
    if (!validUuid(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const result = await deleteRequest(req.params.siteId, id);
    if (!result) {
      return res.status(404).json({ error: 'Request not found' });
    }

    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}
