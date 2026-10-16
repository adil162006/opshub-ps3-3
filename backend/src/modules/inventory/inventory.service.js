import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categories, items, stockMovements } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { getSiteContext, moduleFields, requireRole } from '../shared/workflow.js';

const RANK = { Member: 1, Manager: 2, Admin: 3 };
export const rank = (role) => RANK[role] ?? 0;

export async function getMembership(siteId, userId) {
  return (await getSiteContext(db, siteId, userId, ['inventory'])).role;
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
  const quantityOnHand = body.quantityOnHand ?? body.qty ?? 0;
  const reorderLevel = body.reorderLevel ?? body.reorder ?? 0;
  const unitPrice = body.unitPrice ?? body.price ?? 0;
  const [row] = await db.insert(items).values({
    siteId,
    sku: body.sku,
    name: body.name,
    description: body.description || null,
    unit: body.unit || 'each',
    quantityOnHand: String(quantityOnHand),
    reorderLevel: String(reorderLevel),
    unitPrice: String(unitPrice),
    categoryId: body.categoryId || null,
    metadata: body.metadata || body,
  }).returning();
  return row;
}

export async function updateItem(siteId, id, body) {
  const allowed = ['sku', 'name', 'description', 'unit', 'quantityOnHand', 'reorderLevel', 'unitPrice', 'categoryId', 'metadata'];
  const patch = {};
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const quantity = body.quantityOnHand ?? body.qty;
  const reorder = body.reorderLevel ?? body.reorder;
  const price = body.unitPrice ?? body.price;
  if (quantity !== undefined) patch.quantityOnHand = String(quantity);
  if (reorder !== undefined) patch.reorderLevel = String(reorder);
  if (price !== undefined) patch.unitPrice = String(price);
  const [current] = await db.select({ metadata: items.metadata }).from(items)
    .where(and(eq(items.siteId, siteId), eq(items.id, id))).limit(1);
  if (!current) return null;
  const customValues = { ...body };
  for (const key of ['id', 'site_id', 'siteId', 'createdAt', 'updatedAt', 'quantityOnHand', 'reorderLevel', 'unitPrice']) delete customValues[key];
  patch.metadata = { ...(current.metadata || {}), ...customValues };
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
  const qty = Number(quantity);
  const allowed = ['receipt', 'issue', 'adjustment', 'return', 'transfer_in', 'transfer_out'];
  if (!allowed.includes(movementType)) throw new ApiError(422, `movementType must be one of: ${allowed.join(', ')}`);
  if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(422, 'quantity must be a positive number');
  return db.transaction(async (tx) => {
    const [item] = await tx.select({ id: items.id, quantityOnHand: items.quantityOnHand }).from(items)
      .where(and(eq(items.siteId, siteId), eq(items.id, itemId))).for('update').limit(1);
    if (!item) throw new ApiError(404, 'Item not found');
    const current = Number(item.quantityOnHand);
    const newBalance = ['issue', 'transfer_out'].includes(movementType) ? current - qty : current + qty;
    if (newBalance < 0) throw new ApiError(409, `Insufficient stock: have ${current}, need ${qty}`);
    const [updated] = await tx.update(items).set({ quantityOnHand: String(newBalance), updatedAt: new Date() })
      .where(and(eq(items.siteId, siteId), eq(items.id, itemId), sql`${items.quantityOnHand} = ${String(current)}`))
      .returning({ quantityOnHand: items.quantityOnHand });
    if (!updated) throw new ApiError(409, 'Stock changed while recording movement; retry');
    const [movement] = await tx.insert(stockMovements).values({
      siteId, itemId, movementType, quantity: String(qty), balanceAfter: String(newBalance),
      referenceType: referenceType || null, referenceId: referenceId || null, note: note || null, createdBy: userId,
    }).returning();
    return { movement, newBalance };
  });
}

export async function importItems(siteId, rows, userId) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 5000) throw new ApiError(422, 'rows must contain 1 to 5000 inventory records');
  const { config, role } = await getSiteContext(db, siteId, userId, ['inventory']);
  requireRole(role, 'Manager');
  const fields = moduleFields(config, 'inventory');
  const fieldKey = (canonical, fallback) => fields.find((field) => field.key === canonical)?.key || fallback;
  const normalized = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new ApiError(422, `Row ${index + 1} must be an object`);
    const value = (canonical, fallback, defaultValue) => row[fieldKey(canonical, fallback)] ?? row[fallback] ?? defaultValue;
    const sku = String(value('sku', 'sku', '')).trim();
    const name = String(value('name', 'name', '')).trim();
    if (!sku || sku.length > 120 || !name || name.length > 240) throw new ApiError(422, `Row ${index + 1} requires a SKU (max 120) and name (max 240)`);
    const numeric = (canonical, fallback, defaultValue) => {
      const number = Number(value(canonical, fallback, defaultValue));
      if (!Number.isFinite(number) || number < 0) throw new ApiError(422, `Row ${index + 1}: ${fallback} must be a non-negative number`);
      return number;
    };
    return { sku, name, description: value('description', 'description', '') || null,
      unit: String(value('unit', 'unit', 'each')).trim().slice(0, 40) || 'each',
      quantityOnHand: numeric('qty', 'quantityOnHand', 0), reorderLevel: numeric('reorder', 'reorderLevel', 0),
      unitPrice: numeric('price', 'unitPrice', 0), categoryId: value('categoryId', 'categoryId', null) || null, metadata: row };
  });
  const skuSet = new Set();
  for (const item of normalized) {
    const sku = item.sku.toLowerCase();
    if (skuSet.has(sku)) throw new ApiError(422, `Duplicate SKU in import: ${item.sku}`);
    skuSet.add(sku);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`);
    let created = 0;
    let updated = 0;
    for (const item of normalized) {
      if (item.categoryId) {
        const [category] = await tx.select({ id: categories.id }).from(categories)
          .where(and(eq(categories.siteId, siteId), eq(categories.id, item.categoryId))).limit(1);
        if (!category) throw new ApiError(422, `Category ${item.categoryId} does not belong to this site`);
      }
      const [existing] = await tx.select({ id: items.id }).from(items)
        .where(and(eq(items.siteId, siteId), eq(items.sku, item.sku))).limit(1);
      const values = { siteId, sku: item.sku, name: item.name, description: item.description, unit: item.unit,
        quantityOnHand: String(item.quantityOnHand), reorderLevel: String(item.reorderLevel), unitPrice: String(item.unitPrice),
        categoryId: item.categoryId, metadata: item.metadata, updatedAt: new Date() };
      if (existing) { await tx.update(items).set(values).where(and(eq(items.siteId, siteId), eq(items.id, existing.id))); updated++; }
      else { await tx.insert(items).values(values); created++; }
    }
    return { created, updated };
  });
}
