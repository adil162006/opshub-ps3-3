import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { repairRecords, requests, returns, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { cleanConfiguredFields, getSiteContext, requireRole } from '../shared/workflow.js';

const STAGES = ['diagnosis', 'repairing', 'testing', 'completed'];

async function repairRow(query, siteId, id) {
  const rows = await query.select({
    id: repairRecords.id,
    siteId: repairRecords.siteId,
    ticketNumber: repairRecords.ticketNumber,
    requestId: repairRecords.requestId,
    customerName: repairRecords.customerName,
    customerContact: repairRecords.customerContact,
    device: repairRecords.device,
    serialNo: repairRecords.serialNo,
    fault: repairRecords.fault,
    diagnosis: repairRecords.diagnosis,
    stage: repairRecords.stage,
    statusValue: repairRecords.status,
    technicianId: repairRecords.technicianId,
    technician: users.name,
    partsCost: repairRecords.partsCost,
    labourCost: repairRecords.labourCost,
    metadata: repairRecords.metadata,
    completedAt: repairRecords.completedAt,
    createdAt: repairRecords.createdAt,
    updatedAt: repairRecords.updatedAt,
    requestNumber: requests.requestNumber,
  }).from(repairRecords)
    .leftJoin(users, eq(users.id, repairRecords.technicianId))
    .leftJoin(requests, and(eq(requests.siteId, repairRecords.siteId), eq(requests.id, repairRecords.requestId)))
    .where(and(eq(repairRecords.siteId, siteId), ...(id ? [eq(repairRecords.id, id)] : [])))
    .orderBy(desc(repairRecords.createdAt));
  return rows;
}

async function publicRows(siteId, records, tx = db) {
  const ids = records.map((row) => row.id);
  if (!ids.length) return [];
  const returnedRows = await tx.select({ repairRecordId: returns.repairRecordId, receivedAt: returns.receivedAt })
    .from(returns).where(and(eq(returns.siteId, siteId), inArray(returns.repairRecordId, ids)));
  const returnedAt = new Map();
  returnedRows.forEach((row) => {
    const previous = returnedAt.get(row.repairRecordId);
    if (!previous || new Date(row.receivedAt) > new Date(previous)) returnedAt.set(row.repairRecordId, row.receivedAt);
  });
  return records.map((row) => ({
    ...row.metadata,
    id: row.id,
    site_id: siteId,
    requestId: row.requestId,
    requestNo: row.requestNumber || row.ticketNumber,
    customer: row.customerName || row.metadata?.customer || '',
    customerContact: row.customerContact || row.metadata?.customerContact || row.metadata?.phone || '',
    device: row.device,
    serialNo: row.serialNo || row.metadata?.serialNo || '',
    fault: row.fault,
    diagnosis: row.diagnosis || row.metadata?.diagnosis || '',
    partsCost: Number(row.partsCost),
    labourCost: Number(row.labourCost),
    total: Number(row.partsCost) + Number(row.labourCost),
    status: row.stage,
    technician: row.technician || '',
    returned: row.stage === 'completed' && Boolean(row.completedAt && returnedAt.has(row.id)
      && new Date(returnedAt.get(row.id)) >= new Date(row.completedAt)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function listRepairs(siteId, actorId) {
  await getSiteContext(db, siteId, actorId, ['repair']);
  const records = await repairRow(db, siteId);
  return publicRows(siteId, records);
}

export async function startRepair(siteId, actorId, body) {
  const { config, role } = await getSiteContext(db, siteId, actorId, ['repair']);
  requireRole(role, 'Manager');
  if (!body.requestId) throw new ApiError(422, 'requestId is required');
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(requests)
      .where(and(eq(requests.siteId, siteId), eq(requests.id, body.requestId))).for('update').limit(1);
    if (!request) throw new ApiError(404, 'Request not found');
    if (!['approved', 'open'].includes(request.status)) throw new ApiError(409, `${request.requestNumber} must be approved before repair can start`);
    const values = await cleanConfiguredFields(tx, siteId, config, 'repair', body);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${siteId}))`);
    const [{ total }] = await tx.select({ total: sql`count(*)::int` }).from(repairRecords).where(eq(repairRecords.siteId, siteId));
    const [record] = await tx.insert(repairRecords).values({
      siteId,
      ticketNumber: `REP-${String(Number(total) + 1).padStart(3, '0')}`,
      requestId: request.id,
      customerName: request.metadata?.customer || null,
      customerContact: values.customerContact || request.metadata?.customerContact || request.metadata?.phone || null,
      device: String(values.device || request.metadata?.device || '').trim(),
      serialNo: values.serialNo || request.metadata?.serialNo || null,
      fault: String(values.fault || request.metadata?.fault || request.metadata?.issue || '').trim(),
      diagnosis: values.diagnosis || null,
      partsCost: String(Number(values.partsCost) || 0),
      labourCost: String(Number(values.labourCost) || 0),
      stage: 'diagnosis',
      status: 'in-progress',
      technicianId: actorId,
      metadata: values,
    }).returning();
    if (!record.device || !record.fault) throw new ApiError(422, 'Repair device and fault are required');
    await tx.update(requests).set({ status: 'in-repair', updatedAt: new Date() })
      .where(and(eq(requests.siteId, siteId), eq(requests.id, request.id)));
    const rows = await repairRow(tx, siteId, record.id);
    return (await publicRows(siteId, rows, tx))[0];
  });
}

export async function updateRepair(siteId, id, actorId, body) {
  const { config, role } = await getSiteContext(db, siteId, actorId, ['repair']);
  requireRole(role, 'Manager');
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(repairRecords)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id))).for('update').limit(1);
    if (!current) throw new ApiError(404, 'Repair not found');
    const allowed = await cleanConfiguredFields(tx, siteId, config, 'repair', body, current.metadata || {});
    const patch = { metadata: allowed, updatedAt: new Date() };
    for (const key of ['device', 'fault']) if (body[key] !== undefined) patch[key] = String(body[key]).trim();
    for (const key of ['customerContact', 'serialNo', 'diagnosis']) {
      if (body[key] !== undefined) patch[key] = body[key] === '' ? null : String(body[key]).trim();
    }
    for (const key of ['partsCost', 'labourCost']) if (body[key] !== undefined) patch[key] = String(Number(body[key]));
    if (body.status !== undefined) {
      if (!STAGES.includes(body.status)) throw new ApiError(422, `status must be one of: ${STAGES.join(', ')}`);
      patch.stage = body.status;
      patch.status = body.status === 'completed' ? 'completed' : 'in-progress';
      patch.completedAt = body.status === 'completed' ? new Date() : null;
    }
    if (patch.device !== undefined && !patch.device) throw new ApiError(422, 'device is required');
    if (patch.fault !== undefined && !patch.fault) throw new ApiError(422, 'fault is required');
    const [updated] = await tx.update(repairRecords).set(patch)
      .where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id))).returning();
    if (body.status !== undefined && current.requestId) {
      await tx.update(requests).set({ status: body.status === 'completed' ? 'closed' : 'in-repair', updatedAt: new Date() })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, current.requestId)));
    }
    const rows = await repairRow(tx, siteId, updated.id);
    return (await publicRows(siteId, rows, tx))[0];
  });
}

export async function deleteRepair(siteId, id, actorId) {
  const { role } = await getSiteContext(db, siteId, actorId, ['repair']);
  requireRole(role, 'Admin');
  const [row] = await db.delete(repairRecords).where(and(eq(repairRecords.siteId, siteId), eq(repairRecords.id, id)))
    .returning({ id: repairRecords.id });
  if (!row) throw new ApiError(404, 'Repair not found');
  return { deleted: row.id };
}
