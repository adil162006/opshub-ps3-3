import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { assignmentItems, assignments, consumptionRecords, items, requests, siteMembers, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { getSiteContext, requireRole } from '../shared/workflow.js';

const RANK = { Member: 1, Manager: 2, Admin: 3 };
export const rank = (role) => RANK[role] ?? 0;

export async function getMembership(siteId, userId) {
  const [membership] = await db.select({ role: siteMembers.role }).from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
  if (membership) return membership.role;
  return (await getSiteContext(db, siteId, userId)).role;
}

export async function listConsumption(siteId, assignmentItemId, actorId) {
  await getSiteContext(db, siteId, actorId, ['consumption', 'assignment']);
  const condition = assignmentItemId
    ? and(eq(consumptionRecords.siteId, siteId), eq(consumptionRecords.assignmentItemId, assignmentItemId))
    : eq(consumptionRecords.siteId, siteId);
  const rows = await db.select({
    id: consumptionRecords.id,
    site_id: consumptionRecords.siteId,
    assignmentItemId: consumptionRecords.assignmentItemId,
    quantity: consumptionRecords.quantity,
    consumedOn: consumptionRecords.consumedOn,
    consumedBy: consumptionRecords.consumedBy,
    note: consumptionRecords.note,
    createdAt: consumptionRecords.createdAt,
    consumedByName: users.name,
    itemName: items.name,
    itemSku: items.sku,
    assignmentId: assignments.id,
    assignmentNumber: assignments.assignmentNumber,
    requestId: assignments.requestId,
    assignee: assignments.assignee,
  }).from(consumptionRecords)
    .leftJoin(users, eq(consumptionRecords.consumedBy, users.id))
    .innerJoin(assignmentItems, and(eq(consumptionRecords.assignmentItemId, assignmentItems.id), eq(consumptionRecords.siteId, assignmentItems.siteId)))
    .innerJoin(items, and(eq(assignmentItems.itemId, items.id), eq(assignmentItems.siteId, items.siteId)))
    .innerJoin(assignments, and(eq(assignmentItems.assignmentId, assignments.id), eq(assignmentItems.siteId, assignments.siteId)))
    .where(condition).orderBy(desc(consumptionRecords.createdAt));
  const requestIds = [...new Set(rows.map((row) => row.requestId).filter(Boolean))];
  const requestRows = requestIds.length ? await db.select({ id: requests.id, requestNumber: requests.requestNumber, team: requests.team })
    .from(requests).where(and(eq(requests.siteId, siteId), inArray(requests.id, requestIds))) : [];
  const requestMap = new Map(requestRows.map((row) => [row.id, row]));
  return rows.map((row) => ({
    id: row.id,
    site_id: row.site_id,
    assignmentId: row.assignmentId,
    assignmentItemId: row.assignmentItemId,
    requestNo: requestMap.get(row.requestId)?.requestNumber || row.assignmentNumber,
    itemName: row.itemName,
    qty: Number(row.quantity),
    quantity: Number(row.quantity),
    date: row.consumedOn,
    consumedOn: row.consumedOn,
    note: row.note || '',
    by: row.consumedByName || '',
    createdAt: row.createdAt,
  }));
}

export async function recordConsumption(siteId, body, userId) {
  const { role } = await getSiteContext(db, siteId, userId, ['consumption', 'assignment']);
  requireRole(role, 'Member');
  const qty = Number(body.qty ?? body.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(422, 'qty must be a positive number');
  if (!body.assignmentId && !body.assignmentItemId) throw new ApiError(422, 'assignmentId is required');

  return db.transaction(async (tx) => {
    let assignmentItemId = body.assignmentItemId;
    if (!assignmentItemId) {
      const [assignment] = await tx.select({ id: assignments.id }).from(assignments)
        .where(and(eq(assignments.siteId, siteId), eq(assignments.id, body.assignmentId))).limit(1);
      if (!assignment) throw new ApiError(404, 'Assignment not found');
      const [assignmentItem] = await tx.select({ id: assignmentItems.id }).from(assignmentItems)
        .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.assignmentId, assignment.id))).limit(1);
      if (!assignmentItem) throw new ApiError(404, 'Assignment has no items');
      assignmentItemId = assignmentItem.id;
    }

    const [aItem] = await tx.select({ id: assignmentItems.id, remainingQuantity: assignmentItems.remainingQuantity, assignmentId: assignmentItems.assignmentId })
      .from(assignmentItems).where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.id, assignmentItemId))).for('update').limit(1);
    if (!aItem) throw new ApiError(404, 'Assignment item not found');
    const remaining = Number(aItem.remainingQuantity);
    if (qty > remaining) throw new ApiError(409, `Cannot consume ${qty}; only ${remaining} remaining`);
    const nextRemaining = remaining - qty;
    const [changed] = await tx.update(assignmentItems)
      .set({ remainingQuantity: String(nextRemaining), updatedAt: new Date() })
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.id, assignmentItemId), sql`${assignmentItems.remainingQuantity} >= ${String(qty)}`))
      .returning({ id: assignmentItems.id });
    if (!changed) throw new ApiError(409, 'Assignment quantity changed; retry consumption');

    const allItems = await tx.select({ remainingQuantity: assignmentItems.remainingQuantity }).from(assignmentItems)
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.assignmentId, aItem.assignmentId)));
    if (allItems.length && allItems.every((entry) => Number(entry.remainingQuantity) === 0)) {
      await tx.update(assignments).set({ status: 'completed', updatedAt: new Date() })
        .where(and(eq(assignments.siteId, siteId), eq(assignments.id, aItem.assignmentId), inArray(assignments.status, ['issued', 'in-use'])));
    } else {
      await tx.update(assignments).set({ status: 'in-use', updatedAt: new Date() })
        .where(and(eq(assignments.siteId, siteId), eq(assignments.id, aItem.assignmentId), eq(assignments.status, 'issued')));
    }

    const date = body.date || body.consumedOn || new Date().toISOString().slice(0, 10);
    const [record] = await tx.insert(consumptionRecords).values({
      siteId,
      assignmentItemId,
      quantity: String(qty),
      consumedOn: date,
      consumedBy: userId,
      note: body.note || null,
    }).returning();
    const [assignment] = await tx.select({ id: assignments.id, assignmentNumber: assignments.assignmentNumber, requestId: assignments.requestId })
      .from(assignments).where(and(eq(assignments.siteId, siteId), eq(assignments.id, aItem.assignmentId))).limit(1);
    const [request] = assignment?.requestId ? await tx.select({ requestNumber: requests.requestNumber }).from(requests)
      .where(and(eq(requests.siteId, siteId), eq(requests.id, assignment.requestId))).limit(1) : [];
    const [item] = await tx.select({ name: items.name }).from(assignmentItems)
      .innerJoin(items, and(eq(items.siteId, assignmentItems.siteId), eq(items.id, assignmentItems.itemId)))
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.id, assignmentItemId))).limit(1);
    const [actor] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    return {
      record: {
        id: record.id, site_id: siteId, assignmentId: assignment.id, assignmentItemId,
        requestNo: request?.requestNumber || assignment.assignmentNumber, itemName: item?.name || '', qty, quantity: qty,
        date, consumedOn: date, note: record.note || '', by: actor?.name || '', createdAt: record.createdAt,
      },
      remainingQuantity: nextRemaining,
    };
  });
}
