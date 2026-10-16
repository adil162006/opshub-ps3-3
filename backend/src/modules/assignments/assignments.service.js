import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { assignmentItems, assignments, items, requestItems, requests, siteMembers, stockMovements, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { getSiteContext, requireRole } from '../shared/workflow.js';

const RANK = { Member: 1, Manager: 2, Admin: 3 };
export const rank = (role) => RANK[role] ?? 0;

export async function getMembership(siteId, userId) {
  const [row] = await db.select({ role: siteMembers.role }).from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
  if (row) return row.role;
  const { role } = await getSiteContext(db, siteId, userId);
  return role;
}

async function nextAssignmentNumber(tx, siteId) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`);
  const [{ total }] = await tx.select({ total: sql`count(*)::int` }).from(assignments).where(eq(assignments.siteId, siteId));
  return `ASN-${String(Number(total) + 1).padStart(3, '0')}`;
}

export async function listAssignments(siteId, actorId) {
  await getSiteContext(db, siteId, actorId, ['assignment']);
  const rows = await db.select({
    id: assignments.id,
    siteId: assignments.siteId,
    assignmentNumber: assignments.assignmentNumber,
    requestId: assignments.requestId,
    requestNumber: requests.requestNumber,
    team: requests.team,
    assignedTo: assignments.assignedTo,
    assignee: assignments.assignee,
    assignedBy: assignments.assignedBy,
    status: assignments.status,
    notes: assignments.notes,
    createdAt: assignments.createdAt,
    updatedAt: assignments.updatedAt,
  }).from(assignments)
    .leftJoin(requests, and(eq(requests.siteId, assignments.siteId), eq(requests.id, assignments.requestId)))
    .where(eq(assignments.siteId, siteId)).orderBy(desc(assignments.createdAt));
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const lines = await db.select({
    id: assignmentItems.id,
    assignmentId: assignmentItems.assignmentId,
    itemId: assignmentItems.itemId,
    qty: assignmentItems.quantity,
    remaining: assignmentItems.remainingQuantity,
    itemName: items.name,
    itemSku: items.sku,
    itemUnit: items.unit,
  }).from(assignmentItems)
    .innerJoin(items, and(eq(items.siteId, assignmentItems.siteId), eq(items.id, assignmentItems.itemId)))
    .where(and(eq(assignmentItems.siteId, siteId), inArray(assignmentItems.assignmentId, ids)));
  const actors = [...new Set(rows.flatMap((row) => [row.assignedBy, row.assignedTo]).filter(Boolean))];
  const actorRows = actors.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actors)) : [];
  const actorNames = new Map(actorRows.map((user) => [user.id, user.name]));
  const itemsByAssignment = new Map();
  lines.forEach((line) => {
    const current = itemsByAssignment.get(line.assignmentId) || [];
    current.push(line);
    itemsByAssignment.set(line.assignmentId, current);
  });
  return rows.flatMap((row) => (itemsByAssignment.get(row.id) || []).map((line) => ({
    id: row.id,
    site_id: siteId,
    assignmentNumber: row.assignmentNumber,
    requestId: row.requestId,
    requestNo: row.requestNumber || row.assignmentNumber,
    itemId: line.itemId,
    itemName: line.itemName,
    itemSku: line.itemSku,
    itemUnit: line.itemUnit,
    qty: Number(line.qty),
    remaining: Number(line.remaining),
    assignee: row.assignee || row.team || actorNames.get(row.assignedTo) || 'Unassigned',
    status: row.status,
    issuedBy: actorNames.get(row.assignedBy) || '',
    createdAt: row.createdAt,
    notes: row.notes || '',
    assignmentItemId: line.id,
  })));
}

export async function getAssignment(siteId, id, actorId) {
  const rows = await listAssignments(siteId, actorId);
  return rows.find((row) => row.id === id) || null;
}

/** Create one stock issue from a fully approved request; all writes are atomic. */
export async function createAssignment(siteId, body, userId) {
  if (!body?.requestId) throw new ApiError(422, 'requestId is required');
  const { role } = await getSiteContext(db, siteId, userId, ['assignment', 'request']);
  requireRole(role, 'Manager');
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(requests)
      .where(and(eq(requests.siteId, siteId), eq(requests.id, body.requestId))).for('update').limit(1);
    if (!request) throw new ApiError(404, 'Request not found');
    if (request.status !== 'approved') throw new ApiError(409, `${request.requestNumber} is ${request.status}; it must be approved before assignment`);

    let [requestItem] = await tx.select().from(requestItems)
      .where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, request.id))).limit(1);
    if (!requestItem?.itemId) {
      const config = (await getSiteContext(db, siteId, userId, ['assignment', 'request'])).config;
      const itemField = config?.nodes?.find((node) => node?.data?.type === 'request')?.data?.config?.fields?.find((field) => field.type === 'item');
      const itemId = itemField ? request.metadata?.[itemField.key] : null;
      if (!itemId) throw new ApiError(422, 'Approved request does not reference an inventory item');
      const [item] = await tx.select({ id: items.id, name: items.name, quantityOnHand: items.quantityOnHand })
        .from(items).where(and(eq(items.siteId, siteId), eq(items.id, itemId))).limit(1);
      if (!item) throw new ApiError(404, 'Requested inventory item not found');
      requestItem = { itemId: item.id, quantity: String(request.metadata?.qty || 1), id: null };
    }

    const quantity = Number(body.qty ?? request.metadata?.qty ?? requestItem.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(422, 'qty must be a positive number');
    const requestedQuantity = Number(requestItem.quantity);
    if (Number.isFinite(requestedQuantity) && quantity > requestedQuantity) {
      throw new ApiError(409, `Cannot assign ${quantity}; the request is for ${requestedQuantity}`);
    }
    const [item] = await tx.select({ id: items.id, name: items.name, quantityOnHand: items.quantityOnHand })
      .from(items).where(and(eq(items.siteId, siteId), eq(items.id, requestItem.itemId))).for('update').limit(1);
    if (!item) throw new ApiError(404, 'Inventory item not found');
    const available = Number(item.quantityOnHand);
    if (quantity > available) throw new ApiError(409, `Insufficient stock for ${item.name}: need ${quantity}, have ${available}`);
    const [updatedItem] = await tx.update(items)
      .set({ quantityOnHand: sql`${items.quantityOnHand} - ${String(quantity)}`, updatedAt: new Date() })
      .where(and(eq(items.siteId, siteId), eq(items.id, item.id), sql`${items.quantityOnHand} >= ${String(quantity)}`))
      .returning({ id: items.id, quantityOnHand: items.quantityOnHand });
    if (!updatedItem) throw new ApiError(409, 'Stock changed while creating the assignment; retry');

    const assignmentNumber = await nextAssignmentNumber(tx, siteId);
    const assignee = typeof body.assignee === 'string' && body.assignee.trim() ? body.assignee.trim() : request.team || 'Unassigned';
    if (assignee.length > 180) throw new ApiError(422, 'assignee must be at most 180 characters');
    const [assignment] = await tx.insert(assignments).values({
      siteId,
      assignmentNumber,
      requestId: request.id,
      assignedTo: null,
      assignee,
      assignedBy: userId,
      status: 'issued',
      notes: body.notes || null,
    }).returning();
    const [assignmentItem] = await tx.insert(assignmentItems).values({
      siteId,
      assignmentId: assignment.id,
      itemId: item.id,
      requestItemId: requestItem.id || null,
      quantity: String(quantity),
      remainingQuantity: String(quantity),
    }).returning();
    await tx.insert(stockMovements).values({
      siteId,
      itemId: item.id,
      movementType: 'issue',
      quantity: String(quantity),
      balanceAfter: String(updatedItem.quantityOnHand),
      referenceType: 'assignment',
      referenceId: assignment.id,
      note: `Issued for ${request.requestNumber}`,
      createdBy: userId,
    });
    await tx.update(requests).set({ status: 'assigned', updatedAt: new Date() })
      .where(and(eq(requests.siteId, siteId), eq(requests.id, request.id)));

    const [issuer] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    return {
      id: assignment.id,
      site_id: siteId,
      assignmentNumber,
      requestId: request.id,
      requestNo: request.requestNumber,
      itemId: item.id,
      itemName: item.name,
      qty: quantity,
      remaining: quantity,
      assignee,
      status: assignment.status,
      issuedBy: issuer?.name || '',
      createdAt: assignment.createdAt,
      assignmentItemId: assignmentItem.id,
    };
  });
}

export async function updateAssignment(siteId, id, body) {
  const patch = { updatedAt: new Date() };
  if (body.status !== undefined) {
    const statuses = ['issued', 'in-use', 'completed', 'returned'];
    if (!statuses.includes(body.status)) throw new ApiError(422, `status must be one of: ${statuses.join(', ')}`);
    patch.status = body.status;
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  const [row] = await db.update(assignments).set(patch)
    .where(and(eq(assignments.siteId, siteId), eq(assignments.id, id))).returning();
  return row || null;
}
