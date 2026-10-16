import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listInventory, getInventoryItem, createInventoryItem, updateInventoryItem, deleteInventoryItem,
  importInventory, exportInventory, inventoryTemplate,
  listCategoriesHandler, createCategoryHandler, updateCategoryHandler, deleteCategoryHandler,
  listStockMovementsHandler, recordStockMovementHandler,
} from './inventory.controller.js';

const router = Router();

// inventory
router.get('/sites/:siteId/inventory/export', requireAuth, exportInventory);
router.get('/sites/:siteId/inventory/template', requireAuth, inventoryTemplate);
router.get('/sites/:siteId/inventory', requireAuth, listInventory);
router.get('/sites/:siteId/inventory/:id', requireAuth, getInventoryItem);
router.post('/sites/:siteId/inventory', requireAuth, createInventoryItem);
router.put('/sites/:siteId/inventory/:id', requireAuth, updateInventoryItem);
router.delete('/sites/:siteId/inventory/:id', requireAuth, deleteInventoryItem);
router.post('/sites/:siteId/inventory/import', requireAuth, importInventory);

// categories
router.get('/sites/:siteId/categories', requireAuth, listCategoriesHandler);
router.post('/sites/:siteId/categories', requireAuth, createCategoryHandler);
router.put('/sites/:siteId/categories/:id', requireAuth, updateCategoryHandler);
router.delete('/sites/:siteId/categories/:id', requireAuth, deleteCategoryHandler);

// stock movements
router.get('/sites/:siteId/stock-movements', requireAuth, listStockMovementsHandler);
router.post('/sites/:siteId/stock-movements', requireAuth, recordStockMovementHandler);

export default router;
