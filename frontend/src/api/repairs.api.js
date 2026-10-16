import { createResource, deleteResource, getResource, updateResource } from './resources.api';

export const repairsQueryKey = (siteId) => ['site-data', siteId, 'repairs'];
export const getRepairs = (siteId) => getResource(siteId, 'repairs');
export const createRepair = (siteId, payload) => createResource(siteId, 'repairs', payload);
export const updateRepair = (siteId, id, payload) => updateResource(siteId, 'repairs', id, payload);
export const deleteRepair = (siteId, id) => deleteResource(siteId, 'repairs', id);
