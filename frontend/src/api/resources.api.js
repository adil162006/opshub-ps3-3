import api from '../utils/axios';

const sitePath = (siteId, suffix) => `/api/${siteId}/${suffix}`;

export async function getResource(siteId, resource, params) {
  const { data } = await api.get(sitePath(siteId, resource), { params });
  return data;
}

export async function createResource(siteId, resource, payload) {
  const { data } = await api.post(sitePath(siteId, resource), payload);
  return data;
}

export async function updateResource(siteId, resource, id, payload) {
  const { data } = await api.put(sitePath(siteId, `${resource}/${id}`), payload);
  return data;
}

export async function deleteResource(siteId, resource, id) {
  const { data } = await api.delete(sitePath(siteId, `${resource}/${id}`));
  return data;
}

export async function getCategories(siteId) {
  return getResource(siteId, 'categories');
}

export async function createCategory(siteId, payload) {
  return createResource(siteId, 'categories', payload);
}

export async function updateCategory(siteId, id, payload) {
  return updateResource(siteId, 'categories', id, payload);
}

export async function deleteCategory(siteId, id) {
  return deleteResource(siteId, 'categories', id);
}

export async function getStockMovements(siteId, itemId) {
  return getResource(siteId, 'stock-movements', itemId ? { itemId } : undefined);
}

export async function createStockMovement(siteId, payload) {
  return createResource(siteId, 'stock-movements', payload);
}

export async function exportWorkbook(siteId, resource) {
  const { data, headers } = await api.get(sitePath(siteId, `export/${resource}`), { responseType: 'blob' });
  return {
    blob: data,
    filename: headers['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1] || `${resource}.xlsx`,
  };
}

export async function importInventoryWorkbook(siteId, file) {
  const { data } = await api.post(sitePath(siteId, 'import/inventory'), file, {
    headers: { 'Content-Type': file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  return data;
}
