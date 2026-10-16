import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listInventory, getInventoryItem, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  importInventory, exportInventory, inventoryTemplate,
  listCategoriesHandler, createCategoryHandler, updateCategoryHandler, deleteCategoryHandler,
  listStockMovementsHandler, recordStockMovementHandler,
} from './inventory.controller.js';

const router = Router();

for (const prefix of ['/:siteId', '/sites/:siteId']) {
  router.get(`${prefix}/inventory/export`, requireAuth, exportInventory);
  router.get(`${prefix}/inventory/template`, requireAuth, inventoryTemplate);
  router.get(`${prefix}/inventory`, requireAuth, listInventory);
  router.get(`${prefix}/inventory/:id`, requireAuth, getInventoryItem);
  router.post(`${prefix}/inventory`, requireAuth, createInventoryItem);
  router.put(`${prefix}/inventory/:id`, requireAuth, updateInventoryItem);
  router.delete(`${prefix}/inventory/:id`, requireAuth, deleteInventoryItem);
  router.post(`${prefix}/inventory/import`, requireAuth, importInventory);
  router.get(`${prefix}/categories`, requireAuth, listCategoriesHandler);
  router.post(`${prefix}/categories`, requireAuth, createCategoryHandler);
  router.put(`${prefix}/categories/:id`, requireAuth, updateCategoryHandler);
  router.delete(`${prefix}/categories/:id`, requireAuth, deleteCategoryHandler);
  router.get(`${prefix}/stock-movements`, requireAuth, listStockMovementsHandler);
  router.post(`${prefix}/stock-movements`, requireAuth, recordStockMovementHandler);
}

export default router;
