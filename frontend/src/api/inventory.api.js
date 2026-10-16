import {
  createCategory, createResource, createStockMovement, deleteCategory, deleteResource,
  getCategories, getResource, getStockMovements, updateCategory, updateResource,
} from './resources.api';

export const inventoryQueryKey = (siteId) => ['site-data', siteId, 'inventory'];
export const getInventory = (siteId, params) => getResource(siteId, 'inventory', params);
export const createInventoryItem = (siteId, payload) => createResource(siteId, 'inventory', payload);
export const updateInventoryItem = (siteId, id, payload) => updateResource(siteId, 'inventory', id, payload);
export const deleteInventoryItem = (siteId, id) => deleteResource(siteId, 'inventory', id);
export { createCategory, deleteCategory, getCategories, getStockMovements, updateCategory, createStockMovement };
