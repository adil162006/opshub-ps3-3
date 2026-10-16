import api from '../utils/axios.js';

export const consumptionQueryKey = (siteId, assignmentItemId) => (
  assignmentItemId ? ['site-data', siteId, 'consumption', { assignmentItemId }] : ['site-data', siteId, 'consumption']
);

export async function getConsumption(siteId, assignmentItemId) {
  const { data } = await api.get(`/api/${siteId}/consumption`, {
    params: assignmentItemId ? { assignmentItemId } : undefined,
  });
  return data;
}

export async function recordConsumption(siteId, payload) {
  const { data } = await api.post(`/api/${siteId}/consumption`, payload);
  return data;
}
