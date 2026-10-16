import {
  getMembership, rank,
  listItems, getItem, createItem, updateItem, deleteItem, importItems,
  exportItems, getTemplate,
  listCategories, createCategory, updateCategory, deleteCategory,
  listStockMovements, recordStockMovement,
} from './inventory.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validUuid = (v) => UUID_RE.test(v);

async function resolveRole(req, res, minRank) {
  const { siteId } = req.params;
  if (!validUuid(siteId)) { res.status(400).json({ error: 'siteId must be a valid UUID' }); return null; }
  const role = await getMembership(siteId, req.user.id);
  if (!role) { res.status(403).json({ error: 'You do not have access to this site' }); return null; }
  if (rank(role) < minRank) { res.status(403).json({ error: `Requires rank ${minRank} (you are ${role})` }); return null; }
  return role;
}

export async function listInventory(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const rows = await listItems(req.params.siteId, req.query.search || '');
    return res.json(rows);
  } catch (err) { return next(err); }
}

export async function getInventoryItem(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await getItem(req.params.siteId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Item not found' });
    return res.json(row);
  } catch (err) { return next(err); }
}

export async function createInventoryItem(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    const { sku, name } = req.body;
    if (!sku || !name) return res.status(422).json({ error: 'sku and name are required' });
    const row = await createItem(req.params.siteId, req.body);
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'SKU already exists for this site' });
    return next(err);
  }
}

export async function updateInventoryItem(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await updateItem(req.params.siteId, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Item not found' });
    return res.json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'SKU already exists for this site' });
    return next(err);
  }
}

export async function deleteInventoryItem(req, res, next) {
  try {
    const role = await resolveRole(req, res, 3);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await deleteItem(req.params.siteId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Item not found' });
    return res.json({ deleted: row.id });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Item is referenced by other records and cannot be deleted' });
    return next(err);
  }
}

export async function exportInventory(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const rows = await exportItems(req.params.siteId);
    return res.json({ columns: ['sku', 'name', 'description', 'unit', 'quantityOnHand', 'reorderLevel', 'unitPrice', 'categoryId', 'categoryName'], rows });
  } catch (err) { return next(err); }
}

export async function inventoryTemplate(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    return res.json(getTemplate());
  } catch (err) { return next(err); }
}

// ---- categories ----
export async function listCategoriesHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const rows = await listCategories(req.params.siteId);
    return res.json(rows);
  } catch (err) { return next(err); }
}

export async function createCategoryHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    if (!req.body.name) return res.status(422).json({ error: 'name is required' });
    const row = await createCategory(req.params.siteId, req.body);
    return res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists for this site' });
    return next(err);
  }
}

export async function updateCategoryHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await updateCategory(req.params.siteId, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Category not found' });
    return res.json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists for this site' });
    return next(err);
  }
}

export async function deleteCategoryHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 3);
    if (!role) return;
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'id must be a valid UUID' });
    const row = await deleteCategory(req.params.siteId, req.params.id);
    if (!row) return res.status(404).json({ error: 'Category not found' });
    return res.json({ deleted: row.id });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Category is in use by items and cannot be deleted' });
    return next(err);
  }
}

// ---- stock movements ----
export async function listStockMovementsHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 1);
    if (!role) return;
    const { itemId } = req.query;
    if (itemId && !validUuid(itemId)) return res.status(400).json({ error: 'itemId must be a valid UUID' });
    const rows = await listStockMovements(req.params.siteId, itemId || null);
    return res.json(rows);
  } catch (err) { return next(err); }
}

export async function recordStockMovementHandler(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    const { itemId, movementType, quantity } = req.body;
    if (!itemId || !movementType || quantity === undefined) return res.status(422).json({ error: 'itemId, movementType and quantity are required' });
    if (!validUuid(itemId)) return res.status(400).json({ error: 'itemId must be a valid UUID' });
    const validTypes = ['receipt', 'issue', 'adjustment', 'return', 'transfer_in', 'transfer_out'];
    if (!validTypes.includes(movementType)) return res.status(422).json({ error: `movementType must be one of: ${validTypes.join(', ')}` });
    const result = await recordStockMovement(req.params.siteId, req.body, req.user.id);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

export async function importInventory(req, res, next) {
  try {
    const role = await resolveRole(req, res, 2);
    if (!role) return;
    if (!Array.isArray(req.body.rows)) return res.status(422).json({ error: 'rows[] array is required' });
    const result = await importItems(req.params.siteId, req.body.rows, req.user.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}
