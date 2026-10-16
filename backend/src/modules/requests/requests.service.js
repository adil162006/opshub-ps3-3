import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { items, requestItems, requests, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { approvalSteps, getSiteContext, requireRole, cleanConfiguredFields, moduleFields } from '../shared/workflow.js';
import { configNode } from '../shared/siteContext.js';

const requestSelect = {
  id: requests.id,
  siteId: requests.siteId,
  requestNumber: requests.requestNumber,
  requestedBy: requests.requestedBy,
  requestedByName: users.name,
  status: requests.status,
  priority: requests.priority,
  currentStep: requests.currentStep,
  team: requests.team,
  notes: requests.notes,
  metadata: requests.metadata,
  createdAt: requests.createdAt,
  updatedAt: requests.updatedAt,
};

function publicRequest(row, siteId) {
  const { siteId: _site, requestNumber, currentStep, requestedByName, metadata, ...rest } = row;
  return {
    ...metadata,
    ...rest,
    site_id: siteId,
    requestNo: requestNumber,
    step: currentStep,
    requestedBy: requestedByName || '',
  };
}

export async function listRequests(siteId, actorId) {
  await getSiteContext(db, siteId, actorId, ['request']);
  const rows = await db.select(requestSelect).from(requests)
    .leftJoin(users, eq(requests.requestedBy, users.id))
    .where(eq(requests.siteId, siteId)).orderBy(desc(requests.createdAt));
  return rows.map((row) => publicRequest(row, siteId));
}

export async function createRequest(siteId, actorId, body) {
  const { config, role } = await getSiteContext(db, siteId, actorId, ['request']);
  requireRole(role, 'Member');
  return db.transaction(async (tx) => {
    const metadata = await cleanConfiguredFields(tx, siteId, config, 'request', body);
    const itemField = moduleFields(config, 'request').find((field) => field.type === 'item');
    const hasApproval = Boolean(configNode(config, 'approval')) && approvalSteps(config).length > 0;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`);
    const [{ total }] = await tx.select({ total: sql`count(*)::int` }).from(requests).where(eq(requests.siteId, siteId));
    const requestNumber = `REQ-${String(Number(total) + 1).padStart(3, '0')}`;
    const requestedPriority = body.priority ?? metadata.priority;
    if (requestedPriority !== undefined && !['Low', 'Normal', 'High'].includes(requestedPriority)) {
      throw new ApiError(422, 'priority must be Low, Normal or High');
    }
    const team = body.team ?? metadata.team;
    if (team !== undefined && (typeof team !== 'string' || team.trim().length > 180)) throw new ApiError(422, 'team must be at most 180 characters');
    const priority = requestedPriority || 'Normal';
    const [row] = await tx.insert(requests).values({
      siteId,
      requestNumber,
      requestedBy: actorId,
      status: hasApproval ? 'pending' : 'open',
      priority,
      currentStep: 0,
      team: typeof team === 'string' ? team.trim() : null,
      notes: typeof metadata.notes === 'string' ? metadata.notes : null,
      metadata,
    }).returning();
    if (itemField && metadata[itemField.key]) {
      const [item] = await tx.select({ id: items.id, name: items.name, unitPrice: items.unitPrice })
        .from(items).where(and(eq(items.siteId, siteId), eq(items.id, metadata[itemField.key]))).limit(1);
      const qtyField = moduleFields(config, 'request').find((field) => field.key === 'qty' && field.type === 'number');
      await tx.insert(requestItems).values({
        siteId,
        requestId: row.id,
        itemId: item.id,
        description: item.name,
        quantity: String(Number(qtyField ? metadata[qtyField.key] : 1) || 1),
        unitPrice: item.unitPrice,
      });
    }
    const [created] = await tx.select(requestSelect).from(requests)
      .leftJoin(users, eq(requests.requestedBy, users.id))
      .where(and(eq(requests.siteId, siteId), eq(requests.id, row.id))).limit(1);
    return publicRequest(created, siteId);
  });
}

export async function updateRequest(siteId, requestId, actorId, body) {
  const { config, role } = await getSiteContext(db, siteId, actorId, ['request']);
  requireRole(role, 'Manager');
  return db.transaction(async (tx) => {
    const [current] = await tx.select(requestSelect).from(requests)
      .leftJoin(users, eq(requests.requestedBy, users.id))
      .where(and(eq(requests.siteId, siteId), eq(requests.id, requestId))).limit(1);
    if (!current) throw new ApiError(404, 'Request not found');
    const canEdit = current.status === 'pending' || (current.status === 'open' && approvalSteps(config).length === 0);
    if (!canEdit) throw new ApiError(409, 'Only pending requests can be edited');
    const metadata = await cleanConfiguredFields(tx, siteId, config, 'request', body, current.metadata || {});
    const patch = { metadata, updatedAt: new Date() };
    if (body.priority !== undefined) {
      if (!['Low', 'Normal', 'High'].includes(body.priority)) throw new ApiError(422, 'priority must be Low, Normal or High');
      patch.priority = body.priority;
    } else if (metadata.priority && ['Low', 'Normal', 'High'].includes(metadata.priority)) patch.priority = metadata.priority;
    if (body.team !== undefined || metadata.team !== undefined) patch.team = body.team ?? metadata.team ?? null;
    if (body.notes !== undefined || metadata.notes !== undefined) patch.notes = body.notes ?? metadata.notes ?? null;
    const itemField = moduleFields(config, 'request').find((field) => field.type === 'item');
    const quantityField = moduleFields(config, 'request').find((field) => field.key === 'qty' && field.type === 'number');
    if (itemField && (body[itemField.key] !== undefined || (quantityField && body[quantityField.key] !== undefined))) {
      const [existingItem] = await tx.select({ id: requestItems.id }).from(requestItems)
        .where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, requestId))).limit(1);
      if (metadata[itemField.key]) {
        const [item] = await tx.select({ id: items.id, name: items.name, unitPrice: items.unitPrice }).from(items)
          .where(and(eq(items.siteId, siteId), eq(items.id, metadata[itemField.key]))).limit(1);
        const quantity = Number(quantityField ? metadata[quantityField.key] : 1) || 1;
        if (existingItem) {
          await tx.update(requestItems).set({ itemId: item.id, description: item.name, quantity: String(quantity), unitPrice: item.unitPrice, updatedAt: new Date() })
            .where(and(eq(requestItems.siteId, siteId), eq(requestItems.id, existingItem.id)));
        } else {
          await tx.insert(requestItems).values({ siteId, requestId, itemId: item.id, description: item.name, quantity: String(quantity), unitPrice: item.unitPrice });
        }
      } else {
        await tx.delete(requestItems).where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, requestId)));
      }
    }
    await tx.update(requests).set(patch).where(and(eq(requests.siteId, siteId), eq(requests.id, requestId)));
    const [updated] = await tx.select(requestSelect).from(requests)
      .leftJoin(users, eq(requests.requestedBy, users.id))
      .where(and(eq(requests.siteId, siteId), eq(requests.id, requestId))).limit(1);
    return publicRequest(updated, siteId);
  });
}

export async function deleteRequest(siteId, requestId, actorId) {
  const { role } = await getSiteContext(db, siteId, actorId, ['request']);
  requireRole(role, 'Admin');
  const [row] = await db.delete(requests).where(and(eq(requests.siteId, siteId), eq(requests.id, requestId)))
    .returning({ id: requests.id });
  if (!row) throw new ApiError(404, 'Request not found');
  return { deleted: row.id };
}
