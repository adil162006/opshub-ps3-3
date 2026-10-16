import { and, eq } from 'drizzle-orm';
import { configNode, getSiteContext, requireRole } from './siteContext.js';
import { items } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';

export { getSiteContext, requireRole };

const RANK = { Member: 1, Manager: 2, Admin: 3 };
const DEFAULT_FIELDS = {
  request: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'qty', label: 'Qty', type: 'number' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Normal', 'High'] },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  repair: [
    { key: 'device', label: 'Device / Board', type: 'text', required: true },
    { key: 'fault', label: 'Fault', type: 'text', required: true },
    { key: 'partsCost', label: 'Parts Cost', type: 'number' },
    { key: 'labourCost', label: 'Labour Cost', type: 'number' },
  ],
};

export const roleRank = (role) => RANK[role] || 0;
export const moduleFields = (config, type) => configNode(config, type)?.data?.config?.fields || DEFAULT_FIELDS[type] || [];
export const approvalSteps = (config) => {
  const node = configNode(config, 'approval');
  return node ? (node.data?.config?.steps || ['Manager']) : [];
};

function calculate(formula, row) {
  if (typeof formula !== 'string') return null;
  const expression = formula.replace(/[A-Za-z_]\w*/g, (key) => {
    if (!Object.hasOwn(row, key)) throw new ApiError(422, `Unknown calculated field: ${key}`);
    return String(Number(row[key]) || 0);
  });
  if (!/^[\d\s.+*/()\-]+$/.test(expression)) throw new ApiError(422, 'Invalid calculated field formula');
  try {
    const value = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  } catch {
    throw new ApiError(422, 'Invalid calculated field formula');
  }
}

export async function cleanConfiguredFields(tx, siteId, config, type, body, current = {}) {
  const fields = moduleFields(config, type);
  const result = { ...current };
  for (const field of fields) {
    const key = field.key;
    if (field.type === 'calc') continue;
    const value = body[key] !== undefined ? body[key] : current[key];
    if (value === undefined || value === null || value === '') {
      if (field.required) throw new ApiError(422, `${field.label || key} is required`);
      if (body[key] !== undefined) result[key] = field.type === 'number' ? 0 : '';
      continue;
    }
    if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new ApiError(422, `${field.label || key} must be a non-negative number`);
      result[key] = number;
      continue;
    }
    if (field.type === 'select' && field.options?.length && !field.options.includes(value)) {
      throw new ApiError(422, `${field.label || key} is not a valid choice`);
    }
    if (field.type === 'item') {
      const [item] = await tx.select({ id: items.id }).from(items)
        .where(and(eq(items.siteId, siteId), eq(items.id, value))).limit(1);
      if (!item) throw new ApiError(422, `${field.label || key} must reference an item in this site`);
    }
    result[key] = typeof value === 'string' ? value.trim() : value;
  }
  for (const field of fields.filter((candidate) => candidate.type === 'calc')) {
    result[field.key] = calculate(field.formula, result);
  }
  return result;
}

