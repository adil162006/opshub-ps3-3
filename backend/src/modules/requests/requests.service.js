import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { items, requestItems, requests, sites, users } from '../../db/schema/index.js';
import { AppError } from '../../lib/AppError.js';
import { configNode, getSiteContext, requireRole } from '../shared/siteContext.js';

const ranks = { Member: 1, Manager: 2, Admin: 3 };
const priorities = new Set(['Low', 'Normal', 'High']);
const getFields = (config) => configNode(config, 'request')?.data?.config?.fields || [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High'] },
  { key: 'notes', label: 'Notes', type: 'text' },
];
const getSteps = (config) => configNode(config, 'approval')?.data?.config?.steps ?? ['Manager'];
const requestNo = (n) => `REQ-${String(n).padStart(3, '0')}`;

function parseFields(fields, input, existing = {}) {
  const values = {};
  const errors = [];
  for (const field of fields) {
    const { key, label = key, type = 'text' } = field;
    if (!/^[A-Za-z_]\w*$/.test(key || '')) { errors.push(`Invalid configured field key: ${key}`); continue; }
    if (type === 'calc') continue;
    let value = Object.hasOwn(input, key) ? input[key] : existing[key];
    if (value === undefined || value === null || value === '') {
      if (field.required) errors.push(`${label} is required`);
      values[key] = type === 'number' ? 0 : '';
      continue;
    }
    if (type === 'number') {
      value = Number(value);
      if (!Number.isFinite(value)) { errors.push(`${label} must be a number`); continue; }
      if (value < 0) errors.push(`${label} cannot be negative`);
    } else if (type === 'select' && field.options?.length && !field.options.includes(value)) {
      errors.push(`${label}: invalid option`);
    } else if (type === 'date' && Number.isNaN(Date.parse(value))) {
      errors.push(`${label} must be a valid date`);
    } else if (type === 'item' && (typeof value !== 'string' || !value)) {
      errors.push(`${label} must reference an inventory item`);
    } else if (!['text', 'select', 'date', 'item'].includes(type)) {
      errors.push(`${label} uses unsupported field type`);
    } else if (typeof value !== 'string') {
      value = String(value);
    }
    values[key] = value;
  }
  if (errors.length) throw new AppError(422, 'Validation failed', errors);
  for (const field of fields.filter((candidate) => candidate.type === 'calc')) {
    const formula = field.formula || '';
    if (!/^[\w\s+\-*/().]+$/.test(formula)) throw new AppError(422, `${field.label || field.key}: Formula uses invalid characters`);
    const identifiers = formula.match(/[A-Za-z_]\w*/g) || [];
    const badField = identifiers.find((key) => !fields.some((candidate) => candidate.key === key && candidate.key !== field.key));
    if (badField) throw new AppError(422, `${field.label || field.key}: Unknown field "${badField}"`);
    const expression = formula.replace(/[A-Za-z_]\w*/g, (key) => `(${Number(values[key]) || 0})`);
    try {
      const value = Function(`"use strict"; return (${expression});`)();
      if (!Number.isFinite(value)) throw new Error('not finite');
      values[field.key] = Math.round(value * 100) / 100;
    } catch {
      throw new AppError(422, `${field.label || field.key}: Formula could not be calculated`);
    }
  }
  return values;
}

async function validateItem(executor, siteId, fields, values) {
  const itemField = fields.find((field) => field.type === 'item');
  if (!itemField || !values[itemField.key]) return null;
  const [item] = await executor.select({ id: items.id, name: items.name, price: items.unitPrice })
    .from(items).where(and(eq(items.siteId, siteId), eq(items.id, values[itemField.key]))).limit(1);
  if (!item) throw new AppError(422, `${itemField.label || itemField.key}: unknown item for this site`);
  return { field: itemField, item };
}

function makeResponse(row, fields = [], itemRow = null) {
  const values = { ...(row.metadata || {}) };
  for (const field of fields) {
    if (field.type === 'item' && itemRow) values[field.key] = itemRow.itemId;
  }
  if (row.team !== null && row.team !== undefined && fields.some((field) => field.key === 'team')) values.team = row.team;
  if (row.notes !== null && row.notes !== undefined && fields.some((field) => field.key === 'notes')) values.notes = row.notes;
  return {
    ...values,
    id: row.id, site_id: row.siteId, createdAt: row.createdAt, requestNo: row.requestNumber,
    status: row.status, step: row.currentStep, requestedBy: row.requestedByName || '', priority: row.priority,
  };
}

async function loadRequest(executor, siteId, id) {
  const [row] = await executor.select({
    id: requests.id, siteId: requests.siteId, requestNumber: requests.requestNumber,
    requestedBy: requests.requestedBy, requestedByName: users.name, status: requests.status,
    priority: requests.priority, currentStep: requests.currentStep, team: requests.team, notes: requests.notes,
    metadata: requests.metadata, createdAt: requests.createdAt,
  }).from(requests).leftJoin(users, eq(users.id, requests.requestedBy))
    .where(and(eq(requests.siteId, siteId), eq(requests.id, id))).limit(1);
  if (!row) throw new AppError(404, 'Request not found');
  return row;
}

async function loadItemForRequest(executor, siteId, requestId) {
  const [row] = await executor.select({ itemId: requestItems.itemId })
    .from(requestItems).where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, requestId))).limit(1);
  return row || null;
}

export async function listRequests(siteId, userId) {
  const context = await getSiteContext(db, siteId, userId, ['request']);
  requireRole(context.role, 'Member');
  const fields = getFields(context.config);
  const rows = await db.select({
    id: requests.id, siteId: requests.siteId, requestNumber: requests.requestNumber,
    requestedBy: requests.requestedBy, requestedByName: users.name, status: requests.status,
    priority: requests.priority, currentStep: requests.currentStep, team: requests.team, notes: requests.notes,
    metadata: requests.metadata, createdAt: requests.createdAt,
  }).from(requests).leftJoin(users, eq(users.id, requests.requestedBy))
    .where(eq(requests.siteId, siteId)).orderBy(asc(requests.createdAt));
  const itemRows = await db.select({ requestId: requestItems.requestId, itemId: requestItems.itemId })
    .from(requestItems).where(eq(requestItems.siteId, siteId));
  const itemByRequest = new Map(itemRows.map((row) => [row.requestId, row]));
  return rows.map((row) => makeResponse(row, fields, itemByRequest.get(row.id)));
}

export async function createRequest(siteId, userId, body) {
  return db.transaction(async (tx) => {
    const context = await getSiteContext(tx, siteId, userId, ['request']);
    requireRole(context.role, 'Member');
    const fields = getFields(context.config);
    const values = parseFields(fields, body);
    const itemReference = await validateItem(tx, siteId, fields, values);
    const qtyField = fields.find((field) => field.key === 'qty' && field.type === 'number');
    if (itemReference && (!qtyField || Number(values.qty) <= 0)) {
      throw new AppError(422, 'Qty must be greater than zero when an inventory item is selected');
    }
    const priority = values.priority || 'Normal';
    if (!priorities.has(priority)) throw new AppError(422, 'Priority must be Low, Normal or High');

    // Serialize number allocation per site so concurrent submissions cannot reuse a request number.
    await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).for('update');
    const existingNumbers = await tx.select({ requestNumber: requests.requestNumber }).from(requests).where(eq(requests.siteId, siteId));
    const maxNumber = existingNumbers.reduce((max, row) => Math.max(max, Number(row.requestNumber.match(/(\d+)$/)?.[1] || 0)), 0);
    const [created] = await tx.insert(requests).values({
      siteId, requestNumber: requestNo(maxNumber + 1), requestedBy: userId,
      status: context.types.has('approval') ? 'pending' : 'open', currentStep: 0,
      priority, team: values.team || null, notes: values.notes || null, metadata: values,
    }).returning();
    let itemRow = null;
    if (itemReference) {
      [itemRow] = await tx.insert(requestItems).values({
        siteId, requestId: created.id, itemId: itemReference.item.id,
        description: itemReference.item.name, quantity: String(values.qty),
        unitPrice: String(itemReference.item.price), metadata: {},
      }).returning({ itemId: requestItems.itemId });
    }
    return makeResponse({ ...created, requestedByName: context.actor.name }, fields, itemRow);
  });
}

export async function updateRequest(siteId, userId, id, body) {
  return db.transaction(async (tx) => {
    const context = await getSiteContext(tx, siteId, userId, ['request']);
    requireRole(context.role, 'Manager');
    const [locked] = await tx.select({ id: requests.id }).from(requests)
      .where(and(eq(requests.siteId, siteId), eq(requests.id, id))).for('update').limit(1);
    if (!locked) throw new AppError(404, 'Request not found');
    const row = await loadRequest(tx, siteId, id);
    if (!['pending', 'open'].includes(row.status)) throw new AppError(409, 'Only pending requests can be edited');
    const fields = getFields(context.config);
    const existing = { ...row.metadata, team: row.team || '', notes: row.notes || '', priority: row.priority };
    const values = parseFields(fields, body, existing);
    const itemReference = await validateItem(tx, siteId, fields, values);
    if (itemReference && (!fields.some((field) => field.key === 'qty' && field.type === 'number') || Number(values.qty) <= 0)) {
      throw new AppError(422, 'Qty must be greater than zero when an inventory item is selected');
    }
    const priority = values.priority || 'Normal';
    if (!priorities.has(priority)) throw new AppError(422, 'Priority must be Low, Normal or High');
    const [updated] = await tx.update(requests).set({
      priority, team: values.team || null, notes: values.notes || null, metadata: values, updatedAt: new Date(),
    }).where(and(eq(requests.siteId, siteId), eq(requests.id, id))).returning();
    let itemRow = await loadItemForRequest(tx, siteId, id);
    if (itemReference) {
      if (itemRow) await tx.update(requestItems).set({ itemId: itemReference.item.id, description: itemReference.item.name,
        quantity: String(values.qty), unitPrice: String(itemReference.item.price), updatedAt: new Date() })
        .where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, id)));
      else await tx.insert(requestItems).values({ siteId, requestId: id, itemId: itemReference.item.id,
        description: itemReference.item.name, quantity: String(values.qty), unitPrice: String(itemReference.item.price), metadata: {} });
      itemRow = { itemId: itemReference.item.id };
    } else if (itemRow) {
      await tx.delete(requestItems).where(and(eq(requestItems.siteId, siteId), eq(requestItems.requestId, id)));
      itemRow = null;
    }
    return makeResponse({ ...updated, requestedByName: row.requestedByName }, fields, itemRow);
  });
}

export async function deleteRequest(siteId, userId, id) {
  const context = await getSiteContext(db, siteId, userId, ['request']);
  requireRole(context.role, 'Admin');
  const [deleted] = await db.delete(requests).where(and(eq(requests.siteId, siteId), eq(requests.id, id))).returning({ id: requests.id });
  if (!deleted) throw new AppError(404, 'Request not found');
  return { deleted: id };
}
