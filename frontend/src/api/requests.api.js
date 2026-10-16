import { createResource, deleteResource, getResource, updateResource } from './resources.api';

export const requestsQueryKey = (siteId) => ['site-data', siteId, 'requests'];
export const getRequests = (siteId) => getResource(siteId, 'requests');
export const createRequest = (siteId, payload) => createResource(siteId, 'requests', payload);
export const updateRequest = (siteId, id, payload) => updateResource(siteId, 'requests', id, payload);
export const deleteRequest = (siteId, id) => deleteResource(siteId, 'requests', id);
