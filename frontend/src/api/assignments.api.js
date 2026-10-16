import api from '../utils/axios.js';

export const assignmentsQueryKey = (siteId) => ['site-data', siteId, 'assignments'];
export const assignmentDetailQueryKey = (siteId, id) => ['site-data', siteId, 'assignments', id];

export async function getAssignments(siteId) {
  const { data } = await api.get(`/api/${siteId}/assignments`);
  return data;
}

export async function getAssignment(siteId, id) {
  const { data } = await api.get(`/api/${siteId}/assignments/${id}`);
  return data;
}

export async function createAssignment(siteId, payload) {
  const { data } = await api.post(`/api/${siteId}/assignments`, payload);
  return data;
}

export async function updateAssignment(siteId, id, payload) {
  const { data } = await api.put(`/api/${siteId}/assignments/${id}`, payload);
  return data;
}
