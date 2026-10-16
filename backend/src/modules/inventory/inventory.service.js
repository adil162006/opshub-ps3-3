import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categories, items, siteMembers, stockMovements, users } from '../../db/schema/index.js';

const RANK = { Member: 1, Manager: 2, Admin: 3 };
export const rank = (role) => RANK[role] ?? 0;

export async function getMembership(siteId, userId) {
  const [row] = await db.select({ role: siteMembers.role })
    .from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)))
    .limit(1);
  if (row) return row.role;
  const [user] = await db.select({ isHubAdmin: users.isHubAdmin })
    .from(users).where(eq(users.id, userId)).limit(1);
  return user?.isHubAdmin ? 'Admin' : null;
}

const itemSelect = {
  id: items.id,
  sku: items.sku,
  name: items.name,
  description: items.description,
  unit: items.unit,
  quantityOnHand: items.quantityOnHand,
  reorderLevel: items.reorderLevel,
  unitPrice: items.unitPrice,
  metadata: items.metadata,
  categoryId: items.categoryId,
  categoryName: categories.name,
  createdAt: items.createdAt,
  updatedAt: items.updatedAt,
};

export async function listItems(siteId, search) {
  const condition = search
    ? and(eq(items.siteId, siteId), or(ilike(items.name, `%${search}%`), ilike(items.sku, `%${search}%`)))
    : eq(items.siteId, siteId);
  return db.select(itemSelect)
    .from(items)
    .leftJoin(categories, and(eq(items.categoryId, categories.id), eq(items.siteId, categories.siteId)))
    .where(condition);
}

export async function getItem(siteId, id) {
  const [row] = await db.select(itemSelect)
    .from(items)
    .leftJoin(categories, and(eq(items.categoryId, categories.id), eq(items.siteId, categories.siteId)))
    .where(and(eq(items.siteId, siteId), eq(items.id, id)))
    .limit(1);
  return row || null;
}

export async function createItem(siteId, body) {
  const [row] = await db.insert(items).values({
    siteId,
    sku: body.sku,
    name: body.name,
    description: body.description || null,
    unit: body.unit || 'each',
    quantityOnHand: String(body.quantityOnHand ?? 0),
    reorderLevel: String(body.reorderLevel ?? 0),
    unitPrice: String(body.unitPrice ?? 0),
    categoryId: body.categoryId || null,
    metadata: body.metadata || {},
  }).returning();
  return row;
}

export async function updateItem(siteId, id, body) {
  const allowed = ['sku', 'name', 'description', 'unit', 'quantityOnHand', 'reorderLevel', 'unitPrice', 'categoryId', 'metadata'];
  const patch = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (patch.quantityOnHand !== undefined) patch.quantityOnHand = String(patch.quantityOnHand);
  if (patch.reorderLevel !== undefined) patch.reorderLevel = String(patch.reorderLevel);
  if (patch.unitPrice !== undefined) patch.unitPrice = String(patch.unitPrice);
  patch.updatedAt = new Date();

  const [row] = await db.update(items)
    .set(patch)
    .where(and(eq(items.siteId, siteId), eq(items.id, id)))
    .returning();
  return row || null;
}

export async function deleteItem(siteId, id) {
  const [row] = await db.delete(items)
    .where(and(eq(items.siteId, siteId), eq(items.id, id)))
    .returning({ id: items.id });
  return row || null;
}

// ---- export ----
export async function exportItems(siteId) {
  return listItems(siteId, '');
}

// ---- template ----
export function getTemplate() {
  return {
    columns: ['sku', 'name', 'description', 'unit', 'quantityOnHand', 'reorderLevel', 'unitPrice', 'categoryId'],
    example: {
      sku: 'SKU-001',
      name: 'Example Item',
      description: 'Optional description',
      unit: 'each',
      quantityOnHand: 0,
      reorderLevel: 10,
      unitPrice: 9.99,
      categoryId: 'optional-category-uuid',
    },
  };
}

// ---- categories ----
export async function listCategories(siteId) {
  return db.select({
    id: categories.id,
    name: categories.name,
    description: categories.description,
    isActive: categories.isActive,
    createdAt: categories.createdAt,
    updatedAt: categories.updatedAt,
  }).from(categories).where(eq(categories.siteId, siteId));
}

export async function createCategory(siteId, body) {
  const [row] = await db.insert(categories).values({
    siteId,
    name: body.name,
    description: body.description || null,
    isActive: body.isActive ?? true,
  }).returning();
  return row;
}

export async function updateCategory(siteId, id, body) {
  const patch = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.isActive !== undefined) patch.isActive = body.isActive;
  patch.updatedAt = new Date();
  const [row] = await db.update(categories)
    .set(patch)
    .where(and(eq(categories.siteId, siteId), eq(categories.id, id)))
    .returning();
  return row || null;
}

export async function deleteCategory(siteId, id) {
  const [row] = await db.delete(categories)
    .where(and(eq(categories.siteId, siteId), eq(categories.id, id)))
    .returning({ id: categories.id });
  return row || null;
}

// ---- stock movements ----
export async function listStockMovements(siteId, itemId) {
  const condition = itemId
    ? and(eq(stockMovements.siteId, siteId), eq(stockMovements.itemId, itemId))
    : eq(stockMovements.siteId, siteId);
  return db.select({
    id: stockMovements.id,
    itemId: stockMovements.itemId,
    movementType: stockMovements.movementType,
    quantity: stockMovements.quantity,
    balanceAfter: stockMovements.balanceAfter,
    referenceType: stockMovements.referenceType,
    referenceId: stockMovements.referenceId,
    note: stockMovements.note,
    createdBy: stockMovements.createdBy,
    createdAt: stockMovements.createdAt,
  }).from(stockMovements).where(condition).orderBy(desc(stockMovements.createdAt));
}

export async function recordStockMovement(siteId, body, userId) {
  const { itemId, movementType, quantity, note, referenceType, referenceId } = body;

  // fetch current item
  const [item] = await db.select({ id: items.id, quantityOnHand: items.quantityOnHand })
    .from(items).where(and(eq(items.siteId, siteId), eq(items.id, itemId))).limit(1);
  if (!item) { const err = new Error('Item not found'); err.status = 404; throw err; }

  const current = Number(item.quantityOnHand);
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) { const err = new Error('quantity must be a positive number'); err.status = 422; throw err; }

  // calculate new balance
  const outTypes = ['issue', 'transfer_out'];
  const newBalance = outTypes.includes(movementType) ? current - qty : current + qty;
  if (newBalance < 0) { const err = new Error(`Insufficient stock: have ${current}, need ${qty}`); err.status = 409; throw err; }

  // update item qty and insert movement in one go
  await db.update(items).set({ quantityOnHand: String(newBalance), updatedAt: new Date() })
    .where(and(eq(items.siteId, siteId), eq(items.id, itemId)));

  const [movement] = await db.insert(stockMovements).values({
    siteId,
    itemId,
    movementType,
    quantity: String(qty),
    balanceAfter: String(newBalance),
    referenceType: referenceType || null,
    referenceId: referenceId || null,
    note: note || null,
    createdBy: userId,
  }).returning();

  return { movement, newBalance };
}

export async function importItems(siteId, rows) {
  const results = { created: 0, updated: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.sku || !r.name) {
      results.errors.push({ row: i + 2, message: 'sku and name are required' });
      continue;
    }
    try {
      const [existing] = await db.select({ id: items.id })
        .from(items)
        .where(and(eq(items.siteId, siteId), eq(items.sku, r.sku)))
        .limit(1);
      if (existing) {
        await updateItem(siteId, existing.id, r);
        results.updated++;
      } else {
        await createItem(siteId, r);
        results.created++;
      }
    } catch (err) {
      results.errors.push({ row: i + 2, message: err.message });
    }
  }
  if (results.errors.length) {
    const err = new Error('Import completed with errors');
    err.partial = results;
    throw err;
  }
  return results;
}
