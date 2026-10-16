import api from '../utils/axios.js';

export const requestsQueryKey = (siteId) => ['requests', siteId];

export async function getRequests(siteId) {
  const { data } = await api.get(`/api/${siteId}/requests`);
  return data;
}

export async function createRequest(siteId, payload) {
  const { data } = await api.post(`/api/${siteId}/requests`, payload);
  return data;
}