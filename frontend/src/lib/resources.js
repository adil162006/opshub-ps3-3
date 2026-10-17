import { fieldsOf } from './registry';

export const RES = {
  inventory: { module: 'inventory', read: 1, create: 2, update: 2, delete: 3 },
  requests: { module: 'request', read: 1, create: 1, update: 2, delete: 3 },
  approvals: { module: 'approval', read: 1, create: 9, update: 9, delete: 9 },
  assignments: { module: 'assignment', read: 1, create: 2, update: 9, delete: 9 },
  consumption: { module: 'consumption', read: 1, create: 1, update: 9, delete: 9 },
  returns: { module: 'returns', read: 1, create: 1, update: 9, delete: 9 },
  repairs: { module: 'repair', read: 1, create: 2, update: 2, delete: 3 },
};

const base = (keys) => keys.map((key) => ({ key, label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase()) }));
export function columnsFor(resource, cfg) {
  const fields = (type) => fieldsOf(cfg, type).map(({ key, label }) => ({ key, label }));
  switch (resource) {
    case 'inventory': return fields('inventory');
    case 'requests': return [...base(['requestNo']), ...fields('request'), ...base(['status', 'requestedBy', 'createdAt'])];
    case 'approvals': return base(['requestNo', 'step', 'role', 'decision', 'comment', 'by', 'at']);
    case 'assignments': return base(['requestNo', 'itemName', 'qty', 'remaining', 'assignee', 'status', 'issuedBy', 'createdAt']);
    case 'consumption': return base(['itemName', 'qty', 'note', 'date', 'by']);
    case 'returns': return base(['source', 'refLabel', 'qty', 'condition', 'resolution', 'reason', 'by', 'createdAt']);
    case 'repairs': return [...base(['requestNo']), ...fields('repair'), ...base(['status', 'technician'])];
    default: return [];
  }
}
