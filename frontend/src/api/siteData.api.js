import { createResource, deleteResource, exportWorkbook, getResource, importInventoryWorkbook, updateResource } from './resources.api';
import { evalFormula } from '../lib/registry';

export function makeHttpSiteApi(siteId, preview = false, refresh = () => {}, config = {}) {
  const ensureWritable = () => {
    if (preview) throw new Error('Preview is read-only');
  };
  const inventoryFields = config.nodes?.find((node) => node.data.type === 'inventory')?.data.config?.fields || [];
  const mapInventory = (rows) => rows.map((row) => {
    const mapped = {
      ...(row.metadata || {}), ...row, site_id: siteId,
      qty: Number(row.metadata?.qty ?? row.quantityOnHand ?? 0),
      price: Number(row.metadata?.price ?? row.unitPrice ?? 0),
      reorder: Number(row.metadata?.reorder ?? row.reorderLevel ?? 0),
      category: row.metadata?.category ?? row.categoryName ?? '',
    };
    inventoryFields.filter((field) => field.type === 'calc').forEach((field) => {
      mapped[field.key] = evalFormula(field.formula, mapped);
    });
    return mapped;
  });
  return {
    remote: true,
    list: async (resource) => {
      const data = await getResource(siteId, resource);
      return resource === 'inventory' ? mapInventory(data) : data;
    },
    post: async (resource, payload) => { ensureWritable(); const result = await createResource(siteId, resource, payload); refresh(); return result; },
    put: async (resource, id, payload) => { ensureWritable(); const result = await updateResource(siteId, resource, id, payload); refresh(); return result; },
    del: async (resource, id) => { ensureWritable(); const result = await deleteResource(siteId, resource, id); refresh(); return result; },
    export: (resource) => exportWorkbook(siteId, resource),
    import: async (resource, file) => { ensureWritable(); const result = resource === 'inventory' ? await importInventoryWorkbook(siteId, file) : null; refresh(); return result; },
  };
}
