import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  items,
  repairParts,
  repairRecords,
  requests,
  returns,
  siteMembers,
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

export async function nextTicketNumber(siteId, executor = db) {
  const [result] = await executor
    .select({ count: sql`count(*)::int` })
    .from(repairRecords)
    .where(eq(repairRecords.siteId, siteId));
  return `REP-${String(Number(result?.count || 0) + 1).padStart(3, '0')}`;
}

const STAGES = ['diagnosis', 'repairing', 'testing', 'completed'];
const STATUSES = ['open', 'in-progress', 'completed', 'cancelled'];

function formatRepairRow(row, parts = [], hasReturn = false) {
  const partsCost = Number(row.partsCost || 0);
  const labourCost = Number(row.labourCost || 0);
  const total = partsCost + labourCost;

  return {
    id: row.id,
    siteId: row.siteId,
    site_id: row.siteId,
    ticketNumber: row.ticketNumber,
    requestNo: row.requestNumber || row.ticketNumber,
    requestId: row.requestId,
    customerName: row.customerName,
    customer: row.customerName,
    device: row.device,
    fault: row.fault,
    issue: row.fault,
    stage: row.stage,
    // Frontend prototype expects r.status to be the stage ('diagnosis' | 'repairing' | 'testing' | 'completed')
    status: row.stage,
    recordStatus: row.status,
    technicianId: row.technicianId,
    technician: row.technicianName || '',
    technicianName: row.technicianName || '',
    partsCost,
    labourCost,
    total,
    openedAt: row.openedAt,
    completedAt: row.completedAt,
    returned: Boolean(hasReturn),
    parts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---- List repairs for a site ----
export async function listRepairs(siteId, filters = {}) {
  const conditions = [eq(repairRecords.siteId, siteId)];

  if (filters.stage && STAGES.includes(filters.stage)) {
    conditions.push(eq(repairRecords.stage, filters.stage));
  }
  if (filters.status && STATUSES.includes(filters.status)) {
    conditions.push(eq(repairRecords.status, filters.status));
  }

  const rows = await db
    .select({
      id: repairRecords.id,
      siteId: repairRecords.siteId,
      ticketNumber: repairRecords.ticketNumber,
      requestId: repairRecords.requestId,
      customerName: repairRecords.customerName,
      device: repairRecords.device,
      fault: repairRecords.fault,
      stage: repairRecords.stage,
      status: repairRecords.status,
      technicianId: repairRecords.technicianId,
      partsCost: repairRecords.partsCost,
      labourCost: repairRecords.labourCost,
      openedAt: repairRecords.openedAt,
      completedAt: repairRecords.completedAt,
      createdAt: repairRecords.createdAt,
      updatedAt: repairRecords.updatedAt,
      requestNumber: requests.requestNumber,
      technicianName: users.name,
    })
    .from(repairRecords)
    .leftJoin(
      requests,
      and(eq(repairRecords.requestId, requests.id), eq(repairRecords.siteId, requests.siteId))
    )
    .leftJoin(users, eq(repairRecords.technicianId, users.id))
    .where(and(...conditions))
    .orderBy(desc(repairRecords.openedAt), desc(repairRecords.createdAt));

  if (!rows.length) return [];

  const recordIds = rows.map((r) => r.id);

  // Fetch parts for these repair records
  const allParts = await db
    .select({
      id: repairParts.id,
      siteId: repairParts.siteId,
      repairRecordId: repairParts.repairRecordId,
      itemId: repairParts.itemId,
      description: repairParts.description,
      quantity: repairParts.quantity,
      unitCost: repairParts.unitCost,
      createdAt: repairParts.createdAt,
      itemName: items.name,
      itemSku: items.sku,
    })
    .from(repairParts)
    .leftJoin(
      items,
      and(eq(repairParts.itemId, items.id), eq(repairParts.siteId, items.siteId))
    )
    .where(
      and(
        eq(repairParts.siteId, siteId),
        inArray(repairParts.repairRecordId, recordIds)
      )
    );

  const partsByRecord = {};
  allParts.forEach((p) => {
    if (!partsByRecord[p.repairRecordId]) partsByRecord[p.repairRecordId] = [];
    partsByRecord[p.repairRecordId].push({
      ...p,
      quantity: Number(p.quantity),
      unitCost: Number(p.unitCost),
      totalCost: Number(p.quantity) * Number(p.unitCost),
    });
  });

  // Check which repairs have return records
  const returnedRows = await db
    .select({ repairRecordId: returns.repairRecordId })
    .from(returns)
    .where(
      and(
        eq(returns.siteId, siteId),
        inArray(returns.repairRecordId, recordIds)
      )
    );
  const returnedSet = new Set(returnedRows.map((r) => r.repairRecordId));

  return rows.map((r) => formatRepairRow(r, partsByRecord[r.id] || [], returnedSet.has(r.id)));
}

// ---- Get a single repair by ID ----
export async function getRepair(siteId, id) {
  const [row] = await db
    .select({
      id: repairRecords.id,
      siteId: repairRecords.siteId,
      ticketNumber: repairRecords.ticketNumber,
      requestId: repairRecords.requestId,
      customerName: repairRecords.customerName,
      device: repairRecords.device,
      fault: repairRecords.fault,
      stage: repairRecords.stage,
      status: repairRecords.status,
      technicianId: repairRecords.technicianId,
      partsCost: repairRecords.partsCost,
      labourCost: repairRecords.labourCost,
      openedAt: repairRecords.openedAt,
      completedAt: repairRecords.completedAt,
      createdAt: repairRecords.createdAt,
      updatedAt: repairRecords.updatedAt,
      requestNumber: requests.requestNumber,
      technicianName: users.name,
    })
    .from(repairRecords)
    .leftJoin(
      requests,
      and(eq(repairRecords.requestId, requests.id), eq(repairRecords.siteId, requests.siteId))
    )
    .leftJoin(users, eq(repairRecords.technicianId, users.id))
    .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id)))
    .limit(1);

  if (!row) return null;

  const parts = await db
    .select({
      id: repairParts.id,
      siteId: repairParts.siteId,
      repairRecordId: repairParts.repairRecordId,
      itemId: repairParts.itemId,
      description: repairParts.description,
      quantity: repairParts.quantity,
      unitCost: repairParts.unitCost,
      createdAt: repairParts.createdAt,
      itemName: items.name,
      itemSku: items.sku,
    })
    .from(repairParts)
    .leftJoin(
      items,
      and(eq(repairParts.itemId, items.id), eq(repairParts.siteId, items.siteId))
    )
    .where(and(eq(repairParts.siteId, siteId), eq(repairParts.repairRecordId, id)));

  const formattedParts = parts.map((p) => ({
    ...p,
    quantity: Number(p.quantity),
    unitCost: Number(p.unitCost),
    totalCost: Number(p.quantity) * Number(p.unitCost),
  }));

  const [returnRecord] = await db
    .select({ id: returns.id })
    .from(returns)
    .where(and(eq(returns.siteId, siteId), eq(returns.repairRecordId, id)))
    .limit(1);

  return formatRepairRow(row, formattedParts, Boolean(returnRecord));
}

// ---- Create a repair record ----
export async function createRepair(siteId, body, userId) {
  return db.transaction(async (tx) => {
    let reqRecord = null;
    let requestNumber = null;

    if (body.requestId) {
      const [foundReq] = await tx
        .select()
        .from(requests)
        .where(and(eq(requests.siteId, siteId), eq(requests.id, body.requestId)))
        .limit(1);

      if (!foundReq) {
        const err = new Error('Associated request not found in this site');
        err.status = 404;
        throw err;
      }

      if (foundReq.status !== 'approved') {
        const err = new Error(`${foundReq.requestNumber} is ${foundReq.status}; must be approved`);
        err.status = 409;
        throw err;
      }

      reqRecord = foundReq;
      requestNumber = foundReq.requestNumber;

      // Transition request status to in-repair
      await tx
        .update(requests)
        .set({ status: 'in-repair', updatedAt: new Date() })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, body.requestId)));
    }

    const ticketNumber = body.ticketNumber?.trim() || (await nextTicketNumber(siteId, tx));

    const device =
      body.device ||
      body.title ||
      reqRecord?.metadata?.device ||
      reqRecord?.team ||
      'PCB Device';

    const fault =
      body.fault ||
      body.issue ||
      body.notes ||
      reqRecord?.notes ||
      'Diagnostic testing required';

    const customerName =
      body.customerName ||
      body.customer ||
      reqRecord?.metadata?.customer ||
      reqRecord?.team ||
      null;

    const stage = body.stage && STAGES.includes(body.stage) ? body.stage : 'diagnosis';
    const status = stage === 'completed' ? 'completed' : 'in-progress';
    const partsCost = String(Number(body.partsCost) || 0);
    const labourCost = String(Number(body.labourCost) || 0);
    const technicianId = body.technicianId || userId;

    const [created] = await tx
      .insert(repairRecords)
      .values({
        siteId,
        ticketNumber,
        requestId: body.requestId || null,
        customerName,
        device,
        fault,
        stage,
        status,
        technicianId: technicianId || null,
        partsCost,
        labourCost,
        openedAt: body.openedAt ? new Date(body.openedAt) : new Date(),
        completedAt: stage === 'completed' ? new Date() : null,
      })
      .returning();

    // Insert any initial repair parts provided
    const insertedParts = [];
    if (Array.isArray(body.parts) && body.parts.length > 0) {
      for (const part of body.parts) {
        const qty = Number(part.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const unitCost = String(Number(part.unitCost) || 0);

        // If part links to inventory, verify item in same site
        if (part.itemId) {
          const [invItem] = await tx
            .select()
            .from(items)
            .where(and(eq(items.siteId, siteId), eq(items.id, part.itemId)))
            .limit(1);

          if (!invItem) {
            const err = new Error(`Item ${part.itemId} not found in this site`);
            err.status = 404;
            throw err;
          }
        }

        const [p] = await tx
          .insert(repairParts)
          .values({
            siteId,
            repairRecordId: created.id,
            itemId: part.itemId || null,
            description: part.description || null,
            quantity: String(qty),
            unitCost,
          })
          .returning();
        insertedParts.push(p);
      }
    }

    // Fetch technician name if present
    let technicianName = '';
    if (created.technicianId) {
      const [tech] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, created.technicianId))
        .limit(1);
      technicianName = tech?.name || '';
    }

    return formatRepairRow(
      { ...created, requestNumber, technicianName },
      insertedParts,
      false
    );
  });
}

// ---- Update a repair record ----
export async function updateRepair(siteId, id, body) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(repairRecords)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id)))
      .limit(1);

    if (!existing) return null;

    const patch = { updatedAt: new Date() };

    // Support stage transitions (frontend sends { status: stage } or { stage: stage })
    const requestedStage =
      (body.stage && STAGES.includes(body.stage) && body.stage) ||
      (body.status && STAGES.includes(body.status) && body.status) ||
      null;

    if (requestedStage) {
      patch.stage = requestedStage;
      if (requestedStage === 'completed') {
        patch.status = 'completed';
        patch.completedAt = new Date();

        // If connected to a request, complete/close the request
        if (existing.requestId) {
          await tx
            .update(requests)
            .set({ status: 'closed', updatedAt: new Date() })
            .where(and(eq(requests.siteId, siteId), eq(requests.id, existing.requestId)));
        }
      } else {
        patch.status = 'in-progress';
        patch.completedAt = null;

        // If moved back from completed to an active stage, re-open request as in-repair
        if (existing.requestId) {
          await tx
            .update(requests)
            .set({ status: 'in-repair', updatedAt: new Date() })
            .where(and(eq(requests.siteId, siteId), eq(requests.id, existing.requestId)));
        }
      }
    } else if (body.status && STATUSES.includes(body.status)) {
      patch.status = body.status;
      if (body.status === 'completed') {
        patch.stage = 'completed';
        patch.completedAt = new Date();
        if (existing.requestId) {
          await tx
            .update(requests)
            .set({ status: 'closed', updatedAt: new Date() })
            .where(and(eq(requests.siteId, siteId), eq(requests.id, existing.requestId)));
        }
      }
    }

    if (body.device !== undefined) patch.device = body.device;
    if (body.fault !== undefined || body.issue !== undefined) {
      patch.fault = body.fault ?? body.issue;
    }
    if (body.customerName !== undefined || body.customer !== undefined) {
      patch.customerName = body.customerName ?? body.customer;
    }
    if (body.partsCost !== undefined) {
      const pc = Number(body.partsCost);
      if (Number.isFinite(pc) && pc >= 0) patch.partsCost = String(pc);
    }
    if (body.labourCost !== undefined) {
      const lc = Number(body.labourCost);
      if (Number.isFinite(lc) && lc >= 0) patch.labourCost = String(lc);
    }
    if (body.technicianId !== undefined) {
      patch.technicianId = body.technicianId || null;
    }

    const [updated] = await tx
      .update(repairRecords)
      .set(patch)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id)))
      .returning();

    // Fetch related metadata
    let requestNumber = null;
    if (updated.requestId) {
      const [req] = await tx
        .select({ requestNumber: requests.requestNumber })
        .from(requests)
        .where(and(eq(requests.siteId, siteId), eq(requests.id, updated.requestId)))
        .limit(1);
      requestNumber = req?.requestNumber || null;
    }

    let technicianName = '';
    if (updated.technicianId) {
      const [tech] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, updated.technicianId))
        .limit(1);
      technicianName = tech?.name || '';
    }

    const parts = await tx
      .select({
        id: repairParts.id,
        siteId: repairParts.siteId,
        repairRecordId: repairParts.repairRecordId,
        itemId: repairParts.itemId,
        description: repairParts.description,
        quantity: repairParts.quantity,
        unitCost: repairParts.unitCost,
        createdAt: repairParts.createdAt,
        itemName: items.name,
        itemSku: items.sku,
      })
      .from(repairParts)
      .leftJoin(
        items,
        and(eq(repairParts.itemId, items.id), eq(repairParts.siteId, items.siteId))
      )
      .where(and(eq(repairParts.siteId, siteId), eq(repairParts.repairRecordId, id)));

    const [returnRecord] = await tx
      .select({ id: returns.id })
      .from(returns)
      .where(and(eq(returns.siteId, siteId), eq(returns.repairRecordId, id)))
      .limit(1);

    return formatRepairRow(
      { ...updated, requestNumber, technicianName },
      parts.map((p) => ({
        ...p,
        quantity: Number(p.quantity),
        unitCost: Number(p.unitCost),
        totalCost: Number(p.quantity) * Number(p.unitCost),
      })),
      Boolean(returnRecord)
    );
  });
}

// ---- Delete a repair record ----
export async function deleteRepair(siteId, id) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(repairRecords)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id)))
      .limit(1);

    if (!existing) return null;

    // If associated with a request, revert request back to approved
    if (existing.requestId) {
      await tx
        .update(requests)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, existing.requestId)));
    }

    // Delete repair parts
    await tx
      .delete(repairParts)
      .where(and(eq(repairParts.siteId, siteId), eq(repairParts.repairRecordId, id)));

    // Delete repair record
    await tx
      .delete(repairRecords)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id)));

    return { id };
  });
}

// ---- Add a part to a repair record ----
export async function addRepairPart(siteId, repairRecordId, body) {
  return db.transaction(async (tx) => {
    const [repair] = await tx
      .select()
      .from(repairRecords)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, repairRecordId)))
      .limit(1);

    if (!repair) {
      const err = new Error('Repair record not found');
      err.status = 404;
      throw err;
    }

    const qty = Number(body.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Part quantity must be a positive number');
      err.status = 422;
      throw err;
    }

    let unitCost = Number(body.unitCost);
    let description = body.description || null;

    if (body.itemId) {
      const [item] = await tx
        .select()
        .from(items)
        .where(and(eq(items.siteId, siteId), eq(items.id, body.itemId)))
        .limit(1);

      if (!item) {
        const err = new Error(`Item ${body.itemId} not found in this site`);
        err.status = 404;
        throw err;
      }

      if (!description) description = item.name;
      if (!Number.isFinite(unitCost) || unitCost === 0) {
        unitCost = Number(item.unitPrice || 0);
      }
    }

    unitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;

    const [part] = await tx
      .insert(repairParts)
      .values({
        siteId,
        repairRecordId,
        itemId: body.itemId || null,
        description,
        quantity: String(qty),
        unitCost: String(unitCost),
      })
      .returning();

    // Auto-update repair partsCost with newly added part cost
    const additionalCost = qty * unitCost;
    if (additionalCost > 0) {
      const newPartsCost = Number(repair.partsCost || 0) + additionalCost;
      await tx
        .update(repairRecords)
        .set({ partsCost: String(newPartsCost), updatedAt: new Date() })
        .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, repairRecordId)));
    }

    return {
      ...part,
      quantity: Number(part.quantity),
      unitCost: Number(part.unitCost),
      totalCost: Number(part.quantity) * Number(part.unitCost),
    };
  });
}

// ---- Remove a part from a repair record ----
export async function removeRepairPart(siteId, repairRecordId, partId) {
  return db.transaction(async (tx) => {
    const [part] = await tx
      .select()
      .from(repairParts)
      .where(
        and(
          eq(repairParts.siteId, siteId),
          eq(repairParts.repairRecordId, repairRecordId),
          eq(repairParts.id, partId)
        )
      )
      .limit(1);

    if (!part) return null;

    await tx
      .delete(repairParts)
      .where(
        and(
          eq(repairParts.siteId, siteId),
          eq(repairParts.repairRecordId, repairRecordId),
          eq(repairParts.id, partId)
        )
      );

    // Deduct cost from repair partsCost
    const deductedCost = Number(part.quantity) * Number(part.unitCost);
    if (deductedCost > 0) {
      const [repair] = await tx
        .select({ partsCost: repairRecords.partsCost })
        .from(repairRecords)
        .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, repairRecordId)))
        .limit(1);

      if (repair) {
        const newCost = Math.max(0, Number(repair.partsCost || 0) - deductedCost);
        await tx
          .update(repairRecords)
          .set({ partsCost: String(newCost), updatedAt: new Date() })
          .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, repairRecordId)));
      }
    }

    return { deleted: partId };
  });
}
