import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { assignmentItems, assignments, consumptionRecords, items, siteMembers, users } from '../../db/schema/index.js';

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

// ---- list consumption records ----
export async function listConsumption(siteId, assignmentItemId) {
  const condition = assignmentItemId
    ? and(eq(consumptionRecords.siteId, siteId), eq(consumptionRecords.assignmentItemId, assignmentItemId))
    : eq(consumptionRecords.siteId, siteId);

  return db.select({
    id: consumptionRecords.id,
    assignmentItemId: consumptionRecords.assignmentItemId,
    quantity: consumptionRecords.quantity,
    consumedOn: consumptionRecords.consumedOn,
    consumedBy: consumptionRecords.consumedBy,
    note: consumptionRecords.note,
    createdAt: consumptionRecords.createdAt,
    consumedByName: users.name,
    itemName: items.name,
    itemSku: items.sku,
    assignmentNumber: assignments.assignmentNumber,
  })
    .from(consumptionRecords)
    .leftJoin(users, eq(consumptionRecords.consumedBy, users.id))
    .leftJoin(assignmentItems, and(
      eq(consumptionRecords.assignmentItemId, assignmentItems.id),
      eq(consumptionRecords.siteId, assignmentItems.siteId),
    ))
    .leftJoin(items, and(eq(assignmentItems.itemId, items.id), eq(assignmentItems.siteId, items.siteId)))
    .leftJoin(assignments, and(eq(assignmentItems.assignmentId, assignments.id), eq(assignmentItems.siteId, assignments.siteId)))
    .where(condition)
    .orderBy(desc(consumptionRecords.createdAt));
}

// ---- record consumption ----
export async function recordConsumption(siteId, body, userId) {
  const { assignmentItemId, quantity, note, consumedOn } = body;

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    const err = new Error('quantity must be a positive number'); err.status = 422; throw err;
  }

  return db.transaction(async (tx) => {
    // fetch assignment item
    const [aItem] = await tx.select({
      id: assignmentItems.id,
      remainingQuantity: assignmentItems.remainingQuantity,
      assignmentId: assignmentItems.assignmentId,
    })
      .from(assignmentItems)
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.id, assignmentItemId)))
      .limit(1);

    if (!aItem) { const err = new Error('Assignment item not found'); err.status = 404; throw err; }

    const remaining = Number(aItem.remainingQuantity);
    if (qty > remaining) {
      const err = new Error(`Cannot consume ${qty} — only ${remaining} remaining`);
      err.status = 409; throw err;
    }

    const newRemaining = remaining - qty;

    // update remaining quantity on assignment item
    await tx.update(assignmentItems)
      .set({ remainingQuantity: String(newRemaining), updatedAt: new Date() })
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.id, assignmentItemId)));

    // if all items in assignment are fully consumed, mark assignment as completed
    const allItems = await tx.select({ remainingQuantity: assignmentItems.remainingQuantity })
      .from(assignmentItems)
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.assignmentId, aItem.assignmentId)));

    const allConsumed = allItems.every((i) => Number(i.remainingQuantity) === 0);
    if (allConsumed) {
      await tx.update(assignments)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(and(eq(assignments.siteId, siteId), eq(assignments.id, aItem.assignmentId)));
    }

    // insert consumption record
    const [record] = await tx.insert(consumptionRecords).values({
      siteId,
      assignmentItemId,
      quantity: String(qty),
      consumedOn: consumedOn || new Date().toISOString().slice(0, 10),
      consumedBy: userId,
      note: note || null,
    }).returning();

    return { record, remainingQuantity: newRemaining };
  });
}
