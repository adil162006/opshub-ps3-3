import api from '../utils/axios.js';

export const SITES_QUERY_KEY = ['sites'];

export async function getSites() {
  const { data } = await api.get('/api/sites');
  return data;
}

export async function getSite(siteId, preview = false) {
  const { data } = await api.get(`/api/sites/${siteId}`, {
    params: preview ? { preview: 'true' } : undefined,
  });
  return data;
}

export async function createSite(input) {
  const { data } = await api.post('/api/sites', input);
  return data;
}

export async function saveSiteDraft(siteId, draft) {
  const { data } = await api.put(`/api/sites/${siteId}/draft`, { draft });
  return data;
}

export async function publishSite(siteId, note) {
  const { data } = await api.post(`/api/sites/${siteId}/publish`, { note });
  return data;
}

export async function rollbackSite(siteId, version) {
  const { data } = await api.post(`/api/sites/${siteId}/rollback`, { version });
  return data;
}
