import api from '../utils/axios.js';

export const inventoryQueryKey = (siteId) => ['inventory', siteId];

export async function getInventory(siteId) {
  const { data } = await api.get(`/api/${siteId}/inventory`);
  return data.map((item) => ({
    ...item.metadata,
    ...item,
    site_id: item.siteId,
    qty: Number(item.quantityOnHand),
    reorder: Number(item.reorderLevel),
    price: Number(item.unitPrice),
    category: item.categoryName || item.metadata?.category || '',
  }));
}