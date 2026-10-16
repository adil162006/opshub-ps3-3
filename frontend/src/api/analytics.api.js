import api from '../utils/axios.js';

export const analyticsQueryKey = (siteId) => ['analytics', siteId];

export async function getAnalytics(siteId) {
  const { data } = await api.get(`/api/${siteId}/analytics`);
  return data;
}
