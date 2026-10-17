import api from '../utils/axios.js';

export const GLOBAL_USERS_QUERY_KEY = ['global-users'];
export const siteMembersQueryKey = (siteId) => ['site-members', siteId];

export async function getUsers(page = 1, limit = 100) {
  const { data } = await api.get('/api/users', { params: { page, limit } });
  return data;
}

export async function getAllUsers() {
  const firstPage = await getUsers(1, 100);
  const totalPages = firstPage.pagination?.totalPages || 1;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => getUsers(index + 2, 100)),
  );
  return [firstPage, ...remainingPages].flatMap(({ users = [] }) => users);
}

export async function createUser(input) {
  const { data } = await api.post('/api/users', input);
  return data;
}

export async function updateUser(userId, input) {
  const { data } = await api.patch(`/api/users/${userId}`, input);
  return data;
}

export async function deleteUser(userId) {
  const { data } = await api.delete(`/api/users/${userId}`);
  return data;
}

export async function getSiteUsers(siteId) {
  const { data } = await api.get(`/api/${siteId}/members`);
  return data;
}

export async function addSiteUser(siteId, input) {
  const { data } = await api.post(`/api/${siteId}/members`, input);
  return data;
}

export async function updateSiteUser(siteId, userId, role) {
  const { data } = await api.patch(`/api/${siteId}/members/${userId}`, { role });
  return data;
}

export async function deleteSiteUser(siteId, userId) {
  const { data } = await api.delete(`/api/${siteId}/members/${userId}`);
  return data;
}
