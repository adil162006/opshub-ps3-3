import ExcelJS from 'exceljs';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  approvals, assignmentItems, assignments, categories, consumptionRecords, items,
  repairRecords, requests, returnItems, returns, sites, users,
} from '../../db/schema/index.js';
import { AppError } from '../../lib/AppError.js';
import { configNode, getSiteContext, requireRole } from '../shared/siteContext.js';

const resourceModules = {
  inventory: 'inventory', requests: 'request', approvals: 'approval', assignments: 'assignment',
  consumption: 'consumption', returns: 'returns', repairs: 'repair',
};
const fieldsFor = (config, type) => configNode(config, type)?.data?.config?.fields || [];
const columns = (config, resource) => {
  const fieldColumns = (type) => fieldsFor(config, type).map(({ key, label }) => ({ key, label: label || key }));
  const unique = (cols) => [...new Map(cols.map((col) => [col.key, col])).values()];
  switch (resource) {
    case 'inventory': return unique(fieldColumns('inventory'));
    case 'requests': return unique([{ key: 'requestNo', label: 'Request No' }, ...fieldColumns('request'),
      { key: 'status', label: 'Status' }, { key: 'requestedBy', label: 'Requested By' }, { key: 'createdAt', label: 'Created At' }]);
    case 'approvals': return [
      { key: 'requestNo', label: 'Request No' }, { key: 'step', label: 'Step' }, { key: 'role', label: 'Role' },
      { key: 'decision', label: 'Decision' }, { key: 'comment', label: 'Comment' }, { key: 'by', label: 'By' }, { key: 'at', label: 'At' },
    ];
    case 'assignments': return ['requestNo', 'itemName', 'qty', 'remaining', 'assignee', 'status', 'issuedBy', 'createdAt'].map((key) => ({ key, label: key }));
    case 'consumption': return ['itemName', 'qty', 'note', 'date', 'by'].map((key) => ({ key, label: key }));
    case 'returns': return ['source', 'refLabel', 'qty', 'condition', 'resolution', 'reason', 'by', 'createdAt'].map((key) => ({ key, label: key }));
    case 'repairs': return unique([{ key: 'requestNo', label: 'Request No' }, ...fieldColumns('repair'),
      { key: 'status', label: 'Status' }, { key: 'technician', label: 'Technician' }]);
    default: throw new AppError(404, 'Unknown report resource');
  }
};

async function reportRows(siteId, resource, config) {
  if (resource === 'inventory') {
    const rows = await db.select({ sku: items.sku, name: items.name, category: categories.name,
      qty: items.quantityOnHand, price: items.unitPrice, reorder: items.reorderLevel, metadata: items.metadata })
      .from(items).leftJoin(categories, and(eq(categories.id, items.categoryId), eq(categories.siteId, items.siteId)))
      .where(eq(items.siteId, siteId)).orderBy(asc(items.name));
    return rows.map((row) => ({ ...row.metadata, sku: row.sku, name: row.name, category: row.category || '',
      qty: Number(row.qty), price: Number(row.price), reorder: Number(row.reorder), total: Number(row.qty) * Number(row.price) }));
  }
  if (resource === 'requests') {
    const rows = await db.select({ requestNo: requests.requestNumber, status: requests.status,
      requestedBy: users.name, createdAt: requests.createdAt, team: requests.team, notes: requests.notes,
      priority: requests.priority, metadata: requests.metadata })
      .from(requests).leftJoin(users, eq(users.id, requests.requestedBy))
      .where(eq(requests.siteId, siteId)).orderBy(asc(requests.createdAt));
    return rows.map((row) => ({ ...row.metadata, requestNo: row.requestNo, status: row.status,
      requestedBy: row.requestedBy || '', createdAt: row.createdAt, team: row.team || '', notes: row.notes || '', priority: row.priority }));
  }
  if (resource === 'approvals') {
    const rows = await db.select({ requestNo: requests.requestNumber, step: approvals.step,
      role: approvals.requiredRole, decision: approvals.decision, comment: approvals.comment,
      by: users.name, at: approvals.decidedAt })
      .from(approvals).innerJoin(requests, and(eq(requests.id, approvals.requestId), eq(requests.siteId, approvals.siteId)))
      .leftJoin(users, eq(users.id, approvals.decidedBy)).where(eq(approvals.siteId, siteId)).orderBy(asc(approvals.createdAt));
    return rows.map((row) => ({ ...row, step: row.step + 1, by: row.by || '' }));
  }
  if (resource === 'assignments') {
    const rows = await db.select({ requestNo: requests.requestNumber, itemName: items.name,
      qty: assignmentItems.quantity, remaining: assignmentItems.remainingQuantity,
      assignee: users.name, status: assignments.status, issuedBy: sql`issuer.name`, createdAt: assignments.createdAt })
      .from(assignments).innerJoin(assignmentItems, and(eq(assignmentItems.assignmentId, assignments.id), eq(assignmentItems.siteId, assignments.siteId)))
      .innerJoin(items, and(eq(items.id, assignmentItems.itemId), eq(items.siteId, assignmentItems.siteId)))
      .leftJoin(requests, and(eq(requests.id, assignments.requestId), eq(requests.siteId, assignments.siteId)))
      .leftJoin(users, eq(users.id, assignments.assignedTo))
      .leftJoin(sql`users issuer`, sql`issuer.id = ${assignments.assignedBy}`)
      .where(eq(assignments.siteId, siteId)).orderBy(asc(assignments.createdAt));
    return rows.map((row) => ({ ...row, qty: Number(row.qty), remaining: Number(row.remaining), assignee: row.assignee || 'Unassigned' }));
  }
  if (resource === 'consumption') {
    const rows = await db.select({ itemName: items.name, qty: consumptionRecords.quantity,
      note: consumptionRecords.note, date: consumptionRecords.consumedOn, by: users.name })
      .from(consumptionRecords).innerJoin(assignmentItems, and(eq(assignmentItems.id, consumptionRecords.assignmentItemId), eq(assignmentItems.siteId, consumptionRecords.siteId)))
      .innerJoin(items, and(eq(items.id, assignmentItems.itemId), eq(items.siteId, assignmentItems.siteId)))
      .leftJoin(users, eq(users.id, consumptionRecords.consumedBy))
      .where(eq(consumptionRecords.siteId, siteId)).orderBy(asc(consumptionRecords.consumedOn));
    return rows.map((row) => ({ ...row, qty: Number(row.qty), by: row.by || '' }));
  }
  if (resource === 'returns') {
    const rows = await db.select({ source: returns.type, refLabel: returns.returnNumber,
      qty: returnItems.quantity, condition: returnItems.condition, resolution: returns.status,
      reason: returnItems.notes, by: users.name, createdAt: returns.createdAt })
      .from(returns).innerJoin(returnItems, and(eq(returnItems.returnId, returns.id), eq(returnItems.siteId, returns.siteId)))
      .leftJoin(users, eq(users.id, returns.receivedBy)).where(eq(returns.siteId, siteId)).orderBy(asc(returns.createdAt));
    return rows.map((row) => ({ ...row, source: row.source === 'material' ? 'assignment' : 'repair', qty: Number(row.qty), by: row.by || '' }));
  }
  if (resource === 'repairs') {
    const rows = await db.select({ requestNo: requests.requestNumber, device: repairRecords.device,
      fault: repairRecords.fault, partsCost: repairRecords.partsCost, labourCost: repairRecords.labourCost,
      status: repairRecords.stage, technician: users.name })
      .from(repairRecords).leftJoin(requests, and(eq(requests.id, repairRecords.requestId), eq(requests.siteId, repairRecords.siteId)))
      .leftJoin(users, eq(users.id, repairRecords.technicianId)).where(eq(repairRecords.siteId, siteId))
      .orderBy(asc(repairRecords.openedAt));
    return rows.map((row) => {
      const partsCost = Number(row.partsCost); const labourCost = Number(row.labourCost);
      return { ...row, partsCost, labourCost, total: partsCost + labourCost, technician: row.technician || '' };
    });
  }
  throw new AppError(404, 'Unknown report resource');
}

export async function createExport(siteId, userId, resource) {
  if (!Object.hasOwn(resourceModules, resource)) throw new AppError(404, 'Unknown report resource');
  const context = await getSiteContext(db, siteId, userId, ['reports', resourceModules[resource]]);
  requireRole(context.role, 'Member');
  const headerColumns = columns(context.config, resource);
  const rows = await reportRows(siteId, resource, context.config);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OpsHub';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.columns = headerColumns.map(({ key, label }) => ({ header: label, key, width: Math.min(42, Math.max(14, label.length + 3)) }));
  rows.forEach((row) => worksheet.addRow(Object.fromEntries(headerColumns.map(({ key }) => [key, row[key] ?? ''])));
  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headerColumns.length)}1` };
  const [site] = await db.select({ slug: sites.slug }).from(sites).where(eq(sites.id, siteId)).limit(1);
  const buffer = await workbook.xlsx.writeBuffer();
  const safeSlug = String(site.slug).replace(/[^a-z0-9_-]/gi, '-');
  return { buffer, filename: `${safeSlug}-${resource}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

function normalizedHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function readInventoryRows(buffer, fields) {
  return (async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) throw new AppError(422, 'Workbook must contain a header row and at least one data row');
    const headers = worksheet.getRow(1).values.slice(1).map(normalizedHeader);
    const keyByHeader = new Map();
    fields.forEach((field) => {
      keyByHeader.set(normalizedHeader(field.key), field.key);
      keyByHeader.set(normalizedHeader(field.label || field.key), field.key);
    });
    const mappedHeaders = headers.map((header) => keyByHeader.get(header));
    const errors = [];
    const parsedRows = [];
    const seenSkus = new Set();
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rawValues = row.values.slice(1);
      if (rawValues.every((value) => value === null || value === undefined || value === '')) return;
      const input = {};
      rawValues.forEach((value, index) => {
        const key = mappedHeaders[index];
        if (key) input[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
      });
      const output = {};
      fields.filter((field) => field.type !== 'calc').forEach((field) => {
        let value = input[field.key];
        if (value === null || value === undefined || value === '') {
          if (field.required) errors.push({ row: rowNumber, message: `${field.label || field.key} is required` });
          output[field.key] = field.type === 'number' ? 0 : '';
        } else if (field.type === 'number') {
          value = Number(value);
          if (!Number.isFinite(value) || value < 0) errors.push({ row: rowNumber, message: `${field.label || field.key} must be a nonnegative number` });
          else output[field.key] = value;
        } else if (field.type === 'select' && field.options?.length && !field.options.includes(value)) {
          errors.push({ row: rowNumber, message: `${field.label || field.key}: invalid option` });
        } else output[field.key] = String(value);
      });
      fields.filter((field) => field.type === 'calc').forEach((field) => {
        const expression = String(field.formula || '').replace(/[A-Za-z_]\w*/g, (key) => `(${Number(output[key]) || 0})`);
        if (!/^[\d\s+\-*/().]+$/.test(expression)) errors.push({ row: rowNumber, message: `${field.label || field.key}: invalid formula` });
        else {
          try {
            const value = Function(`"use strict"; return (${expression});`)();
            if (!Number.isFinite(value)) throw new Error('invalid');
            output[field.key] = Math.round(value * 100) / 100;
          } catch { errors.push({ row: rowNumber, message: `${field.label || field.key}: formula could not be calculated` }); }
        }
      });
      if (String(output.sku || '').trim() && String(output.name || '').trim()) {
        const sku = String(output.sku).trim();
        if (seenSkus.has(sku)) errors.push({ row: rowNumber, message: `Duplicate SKU "${sku}" in workbook` });
        else { seenSkus.add(sku); output.sku = sku; output.name = String(output.name).trim();
          if (output.category) output.category = String(output.category).trim();
          parsedRows.push(output); }
      }
      else if (!errors.some((error) => error.row === rowNumber)) errors.push({ row: rowNumber, message: 'SKU and Name are required inventory fields' });
    });
    if (errors.length) throw new AppError(422, 'Import rejected; no rows were written', errors);
    if (!parsedRows.length) throw new AppError(422, 'Workbook contains no inventory rows');
    return parsedRows;
  })();
}

export async function importInventory(siteId, userId, buffer) {
  const context = await getSiteContext(db, siteId, userId, ['reports', 'inventory']);
  requireRole(context.role, 'Manager');
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new AppError(400, 'Upload an .xlsx workbook as the request body');
  const fields = fieldsFor(context.config, 'inventory');
  if (!fields.length) throw new AppError(404, 'Inventory module has no configured fields');
  const rows = await readInventoryRows(buffer, fields);

  return db.transaction(async (tx) => {
    await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).for('update');
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      let categoryId = null;
      if (row.category) {
        await tx.insert(categories).values({ siteId, name: String(row.category).trim() }).onConflictDoNothing();
        const [category] = await tx.select({ id: categories.id }).from(categories)
          .where(and(eq(categories.siteId, siteId), eq(categories.name, String(row.category).trim()))).limit(1);
        categoryId = category?.id || null;
      }
      const value = {
        siteId, sku: String(row.sku), name: String(row.name), categoryId,
        quantityOnHand: String(row.qty ?? 0), reorderLevel: String(row.reorder ?? 0),
        unitPrice: String(row.price ?? 0), metadata: row, updatedAt: new Date(),
      };
      const [existing] = await tx.select({ id: items.id }).from(items)
        .where(and(eq(items.siteId, siteId), eq(items.sku, value.sku))).limit(1);
      if (existing) {
        await tx.update(items).set(value).where(and(eq(items.siteId, siteId), eq(items.id, existing.id)));
        updated++;
      } else {
        await tx.insert(items).values(value);
        created++;
      }
    }
    return { created, updated };
  });
}
