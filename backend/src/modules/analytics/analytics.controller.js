import { getSiteAnalytics } from './analytics.service.js';

export async function getAnalytics(req, res, next) {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.siteId)) {
      return res.status(400).json({ error: 'siteId must be a valid UUID' });
    }
    const result = await getSiteAnalytics(req.params.siteId, req.user.id);
    if (!result) return res.status(404).json({ error: 'Site not found' });
    if (result.forbidden) return res.status(403).json({ error: 'You do not have access to this site' });
    if (result.disabled) return res.status(404).json({ error: 'Analytics module is not enabled on this site' });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
