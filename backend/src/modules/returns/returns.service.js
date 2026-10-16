import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  assignmentItems, assignments, items, repairRecords, requests,
  returnItems, returns, stockMovements, users,
} from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { getSiteContext, requireRole } from '../shared/workflow.js';

export async function listReturns(siteId, actorId) {
  await getSiteContext(db, siteId, actorId, ['returns']);
  const headers = await db.select({
    id: returns.id, siteId: returns.siteId, returnNumber: returns.returnNumber, type: returns.type,
    status: returns.status, assignmentId: returns.assignmentId, repairRecordId: returns.repairRecordId,
    receivedByName: users.name, receivedAt: returns.receivedAt, notes: returns.notes, createdAt: returns.createdAt,
  }).from(returns).leftJoin(users, eq(users.id, returns.receivedBy))
    .where(eq(returns.siteId, siteId)).orderBy(desc(returns.createdAt));
  if (!headers.length) return [];
  const lines = await db.select({
    returnId: returnItems.returnId, qty: returnItems.quantity, condition: returnItems.condition,
    notes: returnItems.notes, itemName: items.name, assignmentId: returnItems.assignmentItemId,
    assignmentNumber: assignments.assignmentNumber, requestNumber: requests.requestNumber,
    repairTicket: repairRecords.ticketNumber, repairDevice: repairRecords.device,
  }).from(returnItems)
    .leftJoin(items, and(eq(items.siteId, returnItems.siteId), eq(items.id, returnItems.itemId)))
    .leftJoin(assignmentItems, and(eq(assignmentItems.siteId, returnItems.siteId), eq(assignmentItems.id, returnItems.assignmentItemId)))
    .leftJoin(assignments, and(eq(assignments.siteId, assignmentItems.siteId), eq(assignments.id, assignmentItems.assignmentId)))
    .leftJoin(requests, and(eq(requests.siteId, assignments.siteId), eq(requests.id, assignments.requestId)))
    .leftJoin(returns, and(eq(returns.siteId, returnItems.siteId), eq(returns.id, returnItems.returnId)))
    .leftJoin(repairRecords, and(eq(repairRecords.siteId, returns.siteId), eq(repairRecords.id, returns.repairRecordId)))
    .where(and(eq(returnItems.siteId, siteId), inArray(returnItems.returnId, headers.map((header) => header.id))))
    .orderBy(asc(returnItems.createdAt));
  const linesByReturn = new Map();
  lines.forEach((line) => {
    const collection = linesByReturn.get(line.returnId) || [];
    collection.push(line);
    linesByReturn.set(line.returnId, collection);
  });
  return headers.flatMap((header) => (linesByReturn.get(header.id) || []).map((line) => {
    const source = header.type === 'repair' ? 'repair' : 'assignment';
    const resolution = source === 'repair' ? line.condition : line.condition === 'damaged' ? 'write-off' : 'restocked';
    return {
      id: header.id,
      site_id: siteId,
      source,
      refId: header.assignmentId || header.repairRecordId,
      refLabel: source === 'repair'
        ? `${line.requestNumber || line.repairTicket || ''} · ${line.repairDevice || ''}`
        : `${line.requestNumber || line.assignmentNumber || ''} · ${line.itemName || ''}`,
      qty: Number(line.qty),
      condition: source === 'repair' ? 'good' : line.condition,
      resolution,
      reason: line.notes || header.notes || '',
      by: header.receivedByName || '',
      status: header.status,
      createdAt: header.createdAt,
    };
  }));
}

export async function createReturn(siteId, actorId, body) {
  if (!['assignment', 'repair'].includes(body.source)) throw new ApiError(422, 'source must be assignment or repair');
  const required = body.source === 'assignment' ? ['returns', 'assignment'] : ['returns', 'repair'];
  const { role } = await getSiteContext(db, siteId, actorId, required);
  requireRole(role, 'Member');
  if (body.source === 'assignment') return createAssignmentReturn(siteId, actorId, body);
  if (body.source === 'repair') return createRepairReturn(siteId, actorId, body);
  throw new ApiError(422, 'source must be assignment or repair');
}

async function nextReturnNumber(tx, siteId) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`);
  const [{ total }] = await tx.select({ total: sql`count(*)::int` }).from(returns).where(eq(returns.siteId, siteId));
  return `RET-${String(Number(total) + 1).padStart(3, '0')}`;
}

async function createAssignmentReturn(siteId, actorId, body) {
  if (!body.refId) throw new ApiError(422, 'refId is required');
  const qty = Number(body.qty);
  if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(422, 'qty must be a positive number');
  if (!['good', 'damaged'].includes(body.condition)) throw new ApiError(422, 'condition must be good or damaged');
  const condition = body.condition === 'damaged' ? 'damaged' : 'good';
  return db.transaction(async (tx) => {
    const [assignment] = await tx.select().from(assignments)
      .where(and(eq(assignments.siteId, siteId), eq(assignments.id, body.refId))).limit(1);
    if (!assignment) throw new ApiError(404, 'Assignment not found');
    let itemRows = await tx.select().from(assignmentItems)
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.assignmentId, assignment.id), sql`${assignmentItems.remainingQuantity} > 0`))
      .for('update');
    if (body.assignmentItemId) itemRows = itemRows.filter((row) => row.id === body.assignmentItemId);
    if (!itemRows.length) throw new ApiError(404, 'Assignment item not found or has nothing remaining');
    if (itemRows.length > 1) throw new ApiError(422, 'assignmentItemId is required when assignment contains multiple items');
    const assignmentItem = itemRows[0];
    const remaining = Number(assignmentItem.remainingQuantity);
    if (qty > remaining) throw new ApiError(409, `Only ${remaining} units remain to return`);
    const itemResult = await tx.update(assignmentItems)
      .set({ remainingQuantity: String(remaining - qty), updatedAt: new Date() })
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.id, assignmentItem.id), sql`${assignmentItems.remainingQuantity} >= ${qty}`))
      .returning({ id: assignmentItems.id });
    if (!itemResult.length) throw new ApiError(409, 'Assignment quantity changed; retry the return');

    let item;
    if (condition === 'good') {
      [item] = await tx.update(items)
        .set({ quantityOnHand: sql`${items.quantityOnHand} + ${String(qty)}`, updatedAt: new Date() })
        .where(and(eq(items.siteId, siteId), eq(items.id, assignmentItem.itemId)))
        .returning({ id: items.id, quantityOnHand: items.quantityOnHand });
      await tx.insert(stockMovements).values({
        siteId, itemId: item.id, movementType: 'return', quantity: String(qty),
        balanceAfter: String(item.quantityOnHand), referenceType: 'return', note: body.reason || null, createdBy: actorId,
      });
    }

    const returnNumber = await nextReturnNumber(tx, siteId);
    const [header] = await tx.insert(returns).values({
      siteId, returnNumber, type: 'material', status: 'accepted', assignmentId: assignment.id,
      receivedBy: actorId, receivedAt: new Date(), notes: body.reason || null,
    }).returning();
    await tx.insert(returnItems).values({
      siteId, returnId: header.id, itemId: assignmentItem.itemId, assignmentItemId: assignmentItem.id,
      quantity: String(qty), condition, notes: body.reason || null,
    });
    const left = await tx.select({ remaining: assignmentItems.remainingQuantity }).from(assignmentItems)
      .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.assignmentId, assignment.id)));
    if (left.every((row) => Number(row.remaining) === 0)) {
      await tx.update(assignments).set({ status: 'returned', updatedAt: new Date() })
        .where(and(eq(assignments.siteId, siteId), eq(assignments.id, assignment.id)));
    }
    const [request] = assignment.requestId
      ? await tx.select({ requestNumber: requests.requestNumber }).from(requests).where(and(eq(requests.siteId, siteId), eq(requests.id, assignment.requestId))).limit(1)
      : [];
    const [stockItem] = await tx.select({ name: items.name }).from(items).where(and(eq(items.siteId, siteId), eq(items.id, assignmentItem.itemId))).limit(1);
    return {
      id: header.id, site_id: siteId, source: 'assignment', refId: assignment.id,
      refLabel: `${request?.requestNumber || assignment.assignmentNumber} · ${stockItem?.name || ''}`,
      qty, condition, resolution: condition === 'damaged' ? 'write-off' : 'restocked',
      reason: body.reason || '', by: (await tx.select({ name: users.name }).from(users).where(eq(users.id, actorId)).limit(1))[0]?.name || '',
      status: header.status, createdAt: header.createdAt,
    };
  });
}

async function createRepairReturn(siteId, actorId, body) {
  if (!body.refId) throw new ApiError(422, 'refId is required');
  if (!['refund', 'redo', 'replace'].includes(body.resolution)) throw new ApiError(422, 'resolution must be refund, redo or replace');
  return db.transaction(async (tx) => {
    const [repair] = await tx.select().from(repairRecords)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, body.refId))).for('update').limit(1);
    if (!repair) throw new ApiError(404, 'Repair not found');
    if (repair.stage !== 'completed') throw new ApiError(409, 'Only completed repairs can be returned');
    const [existing] = await tx.select({ receivedAt: returns.receivedAt }).from(returns)
      .where(and(eq(returns.siteId, siteId), eq(returns.repairRecordId, repair.id)))
      .orderBy(desc(returns.receivedAt)).limit(1);
    if (existing?.receivedAt && repair.completedAt && new Date(existing.receivedAt) >= new Date(repair.completedAt)) {
      throw new ApiError(409, 'This completed repair already has a recorded return');
    }
    const returnNumber = await nextReturnNumber(tx, siteId);
    const [header] = await tx.insert(returns).values({
      siteId, returnNumber, type: 'repair', status: 'accepted', repairRecordId: repair.id,
      receivedBy: actorId, receivedAt: new Date(), notes: body.reason || null,
    }).returning();
    await tx.insert(returnItems).values({
      siteId, returnId: header.id, quantity: '1', condition: body.resolution, notes: body.reason || null,
    });
    if (body.resolution === 'redo') {
      await tx.update(repairRecords).set({ stage: 'diagnosis', status: 'in-progress', completedAt: null, updatedAt: new Date() })
        .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, repair.id)));
      if (repair.requestId) await tx.update(requests).set({ status: 'in-repair', updatedAt: new Date() })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, repair.requestId)));
    }
    const [request] = repair.requestId
      ? await tx.select({ requestNumber: requests.requestNumber }).from(requests).where(and(eq(requests.siteId, siteId), eq(requests.id, repair.requestId))).limit(1)
      : [];
    const [user] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actorId)).limit(1);
    return {
      id: header.id, site_id: siteId, source: 'repair', refId: repair.id,
      refLabel: `${request?.requestNumber || repair.ticketNumber} · ${repair.device}`,
      qty: 1, condition: 'good', resolution: body.resolution,
      reason: body.reason || '', by: user?.name || '', status: header.status, createdAt: header.createdAt,
    };
  });
}
