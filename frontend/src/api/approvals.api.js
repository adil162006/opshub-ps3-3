import api from '../utils/axios.js';

export const approvalsQueryKey = (siteId) => ['approvals', siteId];

export async function getApprovals(siteId) {
  const { data } = await api.get(`/api/${siteId}/approvals`);
  return data;
}

export async function decideApproval(siteId, payload) {
  const { data } = await api.post(`/api/${siteId}/approvals`, payload);
  return data;
}
