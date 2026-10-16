import { ApiError } from '../../lib/ApiError.js';
import { createSite, getSite, listSites, publishDraft, rollbackSite, saveDraft } from './sites.service.js';

export async function listSitesHandler(req, res) {
  res.json(await listSites(req.user.id));
}

export async function getSiteHandler(req, res) {
  res.json(await getSite(req.params.siteId, req.user.id, req.query.preview === 'true'));
}

export async function createSiteHandler(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(422, 'A JSON request body is required');
  res.status(201).json(await createSite(req.user.id, req.body));
}

export async function saveDraftHandler(req, res) {
  res.json(await saveDraft(req.params.siteId, req.user.id, req.body?.draft));
}

export async function publishHandler(req, res) {
  res.json(await publishDraft(req.params.siteId, req.user.id, req.body?.note || ''));
}

export async function rollbackHandler(req, res) {
  res.json(await rollbackSite(req.params.siteId, req.user.id, req.body?.version));
}
