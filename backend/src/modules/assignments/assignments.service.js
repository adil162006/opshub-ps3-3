import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { assignmentItems, assignments, items, requests, siteMembers, users } from '../../db/schema/index.js';

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

async function nextAssignmentNumber(siteId) {
  const [result] = await db.select({ count: sql`count(*)::int` })
    .from(assignments).where(eq(assignments.siteId, siteId));
  return `ASN-${String(Number(result.count) + 1).padStart(3, '0')}`;
}

// ---- list assignments with their items ----
export async function listAssignments(siteId) {
  const rows = await db.select({
    id: assignments.id,
    assignmentNumber: assignments.assignmentNumber,
    requestId: assignments.requestId,
    assignedTo: assignments.assignedTo,
    assignedBy: assignments.assignedBy,
    status: assignments.status,
    notes: assignments.notes,
    createdAt: assignments.createdAt,
    updatedAt: assignments.updatedAt,
    assigneeName: users.name,
  })
    .from(assignments)
    .leftJoin(users, eq(assignments.assignedTo, users.id))
    .where(eq(assignments.siteId, siteId))
    .orderBy(desc(assignments.createdAt));

  // attach items to each assignment
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];

  const aItems = await db.select({
    id: assignmentItems.id,
    assignmentId: assignmentItems.assignmentId,
    itemId: assignmentItems.itemId,
    quantity: assignmentItems.quantity,
    remainingQuantity: assignmentItems.remainingQuantity,
    itemName: items.name,
    itemSku: items.sku,
    itemUnit: items.unit,
  })
    .from(assignmentItems)
    .leftJoin(items, and(eq(assignmentItems.itemId, items.id), eq(assignmentItems.siteId, items.siteId)))
    .where(eq(assignmentItems.siteId, siteId));

  const itemsByAssignment = {};
  aItems.forEach((i) => {
    if (!itemsByAssignment[i.assignmentId]) itemsByAssignment[i.assignmentId] = [];
    itemsByAssignment[i.assignmentId].push(i);
  });

  return rows.map((r) => ({ ...r, items: itemsByAssignment[r.id] || [] }));
}

// ---- get single assignment ----
export async function getAssignment(siteId, id) {
  const [row] = await db.select({
    id: assignments.id,
    assignmentNumber: assignments.assignmentNumber,
    requestId: assignments.requestId,
    assignedTo: assignments.assignedTo,
    assignedBy: assignments.assignedBy,
    status: assignments.status,
    notes: assignments.notes,
    createdAt: assignments.createdAt,
    updatedAt: assignments.updatedAt,
    assigneeName: users.name,
  })
    .from(assignments)
    .leftJoin(users, eq(assignments.assignedTo, users.id))
    .where(and(eq(assignments.siteId, siteId), eq(assignments.id, id)))
    .limit(1);
  if (!row) return null;

  const aItems = await db.select({
    id: assignmentItems.id,
    assignmentId: assignmentItems.assignmentId,
    itemId: assignmentItems.itemId,
    quantity: assignmentItems.quantity,
    remainingQuantity: assignmentItems.remainingQuantity,
    itemName: items.name,
    itemSku: items.sku,
    itemUnit: items.unit,
  })
    .from(assignmentItems)
    .leftJoin(items, and(eq(assignmentItems.itemId, items.id), eq(assignmentItems.siteId, items.siteId)))
    .where(and(eq(assignmentItems.siteId, siteId), eq(assignmentItems.assignmentId, id)));

  return { ...row, items: aItems };
}

// ---- create assignment (deducts stock) ----
export async function createAssignment(siteId, body, userId) {
  const { assignedTo, requestId, notes, items: bodyItems } = body;

  if (!Array.isArray(bodyItems) || !bodyItems.length) {
    const err = new Error('items[] array with at least one entry is required');
    err.status = 422; throw err;
  }

  return db.transaction(async (tx) => {
    // If requestId is provided, validate request exists, belongs to this site, and is approved
    if (requestId) {
      const [req] = await tx
        .select()
        .from(requests)
        .where(and(eq(requests.siteId, siteId), eq(requests.id, requestId)))
        .limit(1);

      if (!req) {
        const err = new Error('Associated request not found in this site');
        err.status = 404;
        throw err;
      }

      if (req.status !== 'approved') {
        const err = new Error(`${req.requestNumber} is ${req.status}; must be approved`);
        err.status = 409;
        throw err;
      }

      await tx
        .update(requests)
        .set({ status: 'assigned', updatedAt: new Date() })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, requestId)));
    }

    // validate and deduct stock for each item
    for (const entry of bodyItems) {
      const [item] = await tx.select({ id: items.id, quantityOnHand: items.quantityOnHand, name: items.name })
        .from(items).where(and(eq(items.siteId, siteId), eq(items.id, entry.itemId))).limit(1);
      if (!item) { const err = new Error(`Item ${entry.itemId} not found`); err.status = 404; throw err; }

      const qty = Number(entry.quantity);
      if (!Number.isFinite(qty) || qty <= 0) { const err = new Error(`Quantity for ${item.name} must be positive`); err.status = 422; throw err; }

      const available = Number(item.quantityOnHand);
      if (qty > available) {
        const err = new Error(`Insufficient stock for ${item.name}: need ${qty}, have ${available}`);
        err.status = 409; throw err;
      }

      await tx.update(items)
        .set({ quantityOnHand: String(available - qty), updatedAt: new Date() })
        .where(and(eq(items.siteId, siteId), eq(items.id, entry.itemId)));
    }

    const assignmentNumber = await nextAssignmentNumber(siteId);

    const [assignment] = await tx.insert(assignments).values({
      siteId,
      assignmentNumber,
      requestId: requestId || null,
      assignedTo: assignedTo || null,
      assignedBy: userId,
      notes: notes || null,
    }).returning();

    const insertedItems = await tx.insert(assignmentItems).values(
      bodyItems.map((entry) => ({
        siteId,
        assignmentId: assignment.id,
        itemId: entry.itemId,
        requestItemId: entry.requestItemId || null,
        quantity: String(entry.quantity),
        remainingQuantity: String(entry.quantity),
      })),
    ).returning();

    return { ...assignment, items: insertedItems };
  });
}

// ---- update assignment status ----
export async function updateAssignment(siteId, id, body) {
  const validStatuses = ['issued', 'in-use', 'completed', 'returned'];
  const patch = {};
  if (body.status) {
    if (!validStatuses.includes(body.status)) {
      const err = new Error(`status must be one of: ${validStatuses.join(', ')}`);
      err.status = 422; throw err;
    }
    patch.status = body.status;
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  patch.updatedAt = new Date();

  const [row] = await db.update(assignments)
    .set(patch)
    .where(and(eq(assignments.siteId, siteId), eq(assignments.id, id)))
    .returning();
  return row || null;
}
