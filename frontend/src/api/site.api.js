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
