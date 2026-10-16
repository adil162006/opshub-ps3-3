import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  approvals,
  items,
  requestItems,
  requests,
  siteMembers,
  siteVersions,
  sites,
  users,
} from '../../db/schema/index.js';

const RANK = { Member: 1, Manager: 2, Admin: 3 };
export const rank = (role) => RANK[role] ?? 0;

export async function getMembership(siteId, userId) {
  const [row] = await db
    .select({ role: siteMembers.role })
    .from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)))
    .limit(1);

  if (row) return row.role;

  const [user] = await db
    .select({ isHubAdmin: users.isHubAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.isHubAdmin ? 'Admin' : null;
}

export async function getSiteConfig(siteId, executor = db) {
  const [site] = await executor
    .select({ id: sites.id, liveVersionId: sites.liveVersionId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site || !site.liveVersionId) return null;

  const [version] = await executor
    .select({ config: siteVersions.config })
    .from(siteVersions)
    .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId)))
    .limit(1);

  return version?.config || null;
}

export function stepsOf(config) {
  if (!config?.nodes) return ['Manager'];
  const node = config.nodes.find((n) => n?.data?.type === 'approval');
  if (!node) return [];
  return node.data?.config?.steps || ['Manager'];
}

export function fieldsOf(config, type) {
  if (!config?.nodes) return null;
  const node = config.nodes.find((n) => n?.data?.type === type);
  return node?.data?.config?.fields || null;
}

export async function nextRequestNumber(siteId, executor = db) {
  const [result] = await executor
    .select({ count: sql`count(*)::int` })
    .from(requests)
    .where(eq(requests.siteId, siteId));

  return `REQ-${String(Number(result?.count || 0) + 1).padStart(3, '0')}`;
}

function formatRequestRow(row, reqItems = [], reqApprovals = []) {
  const metadata = typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {};

  // Standard flattened output compatible with both DB schema & frontend prototype
  return {
    ...metadata,
    id: row.id,
    siteId: row.siteId,
    site_id: row.siteId,
    requestNumber: row.requestNumber,
    requestNo: row.requestNumber,
    status: row.status,
    priority: row.priority || 'Normal',
    currentStep: row.currentStep,
    step: row.currentStep,
    team: row.team || metadata.team || '',
    notes: row.notes || metadata.notes || '',
    requestedBy: row.requestedByName || row.requestedBy || 'Unknown',
    requestedById: row.requestedBy,
    metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: reqItems,
    approvals: reqApprovals,
  };
}

// ---- LIST REQUESTS ----
export async function listRequests(siteId, filters = {}) {
  const conditions = [eq(requests.siteId, siteId)];

  if (filters.status) {
    conditions.push(eq(requests.status, filters.status));
  }
  if (filters.priority) {
    conditions.push(eq(requests.priority, filters.priority));
  }

  const rows = await db
    .select({
      id: requests.id,
      siteId: requests.siteId,
      requestNumber: requests.requestNumber,
      requestedBy: requests.requestedBy,
      status: requests.status,
      priority: requests.priority,
      currentStep: requests.currentStep,
      team: requests.team,
      notes: requests.notes,
      metadata: requests.metadata,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      requestedByName: users.name,
      requestedByEmail: users.email,
    })
    .from(requests)
    .leftJoin(users, eq(requests.requestedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(requests.createdAt));

  if (!rows.length) return [];

  const requestIds = rows.map((r) => r.id);

  // Fetch items
  const allItems = await db
    .select({
      id: requestItems.id,
      requestId: requestItems.requestId,
      itemId: requestItems.itemId,
      description: requestItems.description,
      quantity: requestItems.quantity,
      unitPrice: requestItems.unitPrice,
      metadata: requestItems.metadata,
      itemName: items.name,
      itemSku: items.sku,
    })
    .from(requestItems)
    .leftJoin(items, and(eq(requestItems.itemId, items.id), eq(requestItems.siteId, items.siteId)))
    .where(and(eq(requestItems.siteId, siteId), inArray(requestItems.requestId, requestIds)));

  const itemsByReq = {};
  allItems.forEach((it) => {
    if (!itemsByReq[it.requestId]) itemsByReq[it.requestId] = [];
    itemsByReq[it.requestId].push({
      ...it,
      quantity: Number(it.quantity),
      unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
    });
  });

  return rows.map((row) => formatRequestRow(row, itemsByReq[row.id] || []));
}

// ---- GET SINGLE REQUEST ----
export async function getRequest(siteId, id) {
  const [row] = await db
    .select({
      id: requests.id,
      siteId: requests.siteId,
      requestNumber: requests.requestNumber,
      requestedBy: requests.requestedBy,
      status: requests.status,
      priority: requests.priority,
      currentStep: requests.currentStep,
      team: requests.team,
      notes: requests.notes,
      metadata: requests.metadata,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      requestedByName: users.name,
      requestedByEmail: users.email,
    })
    .from(requests)
    .leftJoin(users, eq(requests.requestedBy, users.id))
    .where(and(eq(requests.siteId, siteId), eq(requests.id, id)))
    .limit(1);

  if (!row) return null;

  const reqItems = await db
    .select({
      id: requestItems.id,
      requestId: requestItems.requestId,
      itemId: requestItems.itemId,
      description: requestItems.description,
      quantity: requestItems.quantity,
      unitPrice: requestItems.unitPrice,
      metadata: requestItems.metadata,
      itemName: items.name,
      itemSku: items.sku,
    })
    .from(requestItems)
    .leftJoin(items, and(eq(requestItems.itemId, items.id), eq(requestItems.siteId, items.siteId)))
    .where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, id)));

  const reqApprovals = await db
    .select({
      id: approvals.id,
      requestId: approvals.requestId,
      step: approvals.step,
      requiredRole: approvals.requiredRole,
      role: approvals.requiredRole,
      decision: approvals.decision,
      comment: approvals.comment,
      decidedBy: approvals.decidedBy,
      by: users.name,
      decidedAt: approvals.decidedAt,
      at: approvals.decidedAt,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .leftJoin(users, eq(approvals.decidedBy, users.id))
    .where(and(eq(approvals.siteId, siteId), eq(approvals.requestId, id)))
    .orderBy(approvals.step);

  return formatRequestRow(
    row,
    reqItems.map((it) => ({
      ...it,
      quantity: Number(it.quantity),
      unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
    })),
    reqApprovals,
  );
}

// ---- CREATE REQUEST ----
export async function createRequest(siteId, body, userId) {
  const config = await getSiteConfig(siteId);
  const steps = stepsOf(config);
  const hasApprovalChain = steps.length > 0;

  // Determine initial status:
  // If approval chain exists, status is 'pending' (step 0)
  // If no approval module connected, request is automatically 'approved'
  const initialStatus = hasApprovalChain ? 'pending' : 'approved';

  const validPriorities = ['Low', 'Normal', 'High'];
  const priority = validPriorities.includes(body.priority) ? body.priority : 'Normal';

  const team = typeof body.team === 'string' ? body.team.trim() : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

  // Validate configured fields if site config exists
  const configuredFields = fieldsOf(config, 'request');
  if (configuredFields) {
    const errors = [];
    for (const f of configuredFields) {
      if (f.type === 'calc') continue;
      const v = body[f.key];
      if (f.required && (v === undefined || v === null || v === '')) {
        errors.push(`${f.label} is required`);
      }
      if (f.type === 'number' && v !== undefined && v !== null && v !== '') {
        const num = Number(v);
        if (!Number.isFinite(num)) {
          errors.push(`${f.label} must be a number`);
        } else if (num < 0) {
          errors.push(`${f.label} cannot be negative`);
        }
      }
      if (f.type === 'select' && f.options?.length && v && !f.options.includes(v)) {
        errors.push(`${f.label}: invalid option`);
      }
    }
    if (errors.length) {
      const err = new Error(errors.join(', '));
      err.status = 422;
      throw err;
    }
  }

  // Handle single item or array of items
  let itemEntries = [];
  if (Array.isArray(body.items) && body.items.length > 0) {
    itemEntries = body.items;
  } else if (body.itemId) {
    const qty = Number(body.qty ?? 1);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantity must be positive');
      err.status = 422;
      throw err;
    }
    itemEntries = [{ itemId: body.itemId, quantity: qty, description: body.title || null }];
  }

  // Metadata stores extra fields (e.g. title, customer, device, issue, estimate, etc.)
  const reservedKeys = new Set(['siteId', 'site_id', 'priority', 'team', 'notes', 'status', 'currentStep', 'step', 'items']);
  const metadata = {};
  for (const [key, val] of Object.entries(body)) {
    if (!reservedKeys.has(key) && val !== undefined) {
      metadata[key] = val;
    }
  }

  return db.transaction(async (tx) => {
    // Validate each item belongs to the same site
    for (const entry of itemEntries) {
      if (entry.itemId) {
        const [foundItem] = await tx
          .select({ id: items.id, name: items.name, unitPrice: items.unitPrice })
          .from(items)
          .where(and(eq(items.siteId, siteId), eq(items.id, entry.itemId)))
          .limit(1);

        if (!foundItem) {
          const err = new Error(`Item ${entry.itemId} not found in this site`);
          err.status = 422;
          throw err;
        }
        if (entry.unitPrice == null && foundItem.unitPrice != null) {
          entry.unitPrice = foundItem.unitPrice;
        }
      }
    }

    const requestNumber = await nextRequestNumber(siteId, tx);

    const [createdReq] = await tx
      .insert(requests)
      .values({
        siteId,
        requestNumber,
        requestedBy: userId,
        status: initialStatus,
        priority,
        currentStep: 0,
        team,
        notes,
        metadata,
      })
      .returning();

    // Insert requestItems if any
    let insertedItems = [];
    if (itemEntries.length > 0) {
      insertedItems = await tx
        .insert(requestItems)
        .values(
          itemEntries.map((entry) => ({
            siteId,
            requestId: createdReq.id,
            itemId: entry.itemId || null,
            description: entry.description || null,
            quantity: String(entry.quantity),
            unitPrice: entry.unitPrice != null ? String(entry.unitPrice) : null,
            metadata: entry.metadata || {},
          })),
        )
        .returning();
    }

    // Fetch user name for requestedBy
    let requestedByName = 'Unknown';
    if (userId) {
      const [u] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      if (u?.name) requestedByName = u.name;
    }

    return formatRequestRow(
      { ...createdReq, requestedByName },
      insertedItems.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
      })),
    );
  });
}

// ---- UPDATE REQUEST ----
export async function updateRequest(siteId, id, body, userId) {
  const [existing] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.siteId, siteId), eq(requests.id, id)))
    .limit(1);

  if (!existing) return null;

  if (existing.status !== 'pending' && existing.status !== 'open') {
    const err = new Error('Only pending requests can be edited');
    err.status = 409;
    throw err;
  }

  const patch = { updatedAt: new Date() };

  if (body.priority) {
    const validPriorities = ['Low', 'Normal', 'High'];
    if (!validPriorities.includes(body.priority)) {
      const err = new Error('priority must be Low, Normal, or High');
      err.status = 422;
      throw err;
    }
    patch.priority = body.priority;
  }

  if (body.team !== undefined) patch.team = body.team;
  if (body.notes !== undefined) patch.notes = body.notes;

  // Merge metadata with new values
  const reservedKeys = new Set(['id', 'siteId', 'site_id', 'requestNumber', 'requestNo', 'requestedBy', 'status', 'currentStep', 'step', 'createdAt', 'updatedAt', 'priority', 'team', 'notes']);
  const newMeta = { ...(existing.metadata || {}) };
  for (const [key, val] of Object.entries(body)) {
    if (!reservedKeys.has(key)) {
      newMeta[key] = val;
    }
  }
  patch.metadata = newMeta;

  const [updated] = await db
    .update(requests)
    .set(patch)
    .where(and(eq(requests.siteId, siteId), eq(requests.id, id)))
    .returning();

  return getRequest(siteId, updated.id);
}

// ---- DELETE REQUEST ----
export async function deleteRequest(siteId, id) {
  const [existing] = await db
    .select({ id: requests.id, requestNumber: requests.requestNumber })
    .from(requests)
    .where(and(eq(requests.siteId, siteId), eq(requests.id, id)))
    .limit(1);

  if (!existing) return null;

  try {
    await db.delete(requests).where(and(eq(requests.siteId, siteId), eq(requests.id, id)));
    return { deleted: id, requestNumber: existing.requestNumber };
  } catch (err) {
    if (err.code === '23503') {
      const conflict = new Error('Cannot delete request: referenced by assignments, repairs, or other records');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}
