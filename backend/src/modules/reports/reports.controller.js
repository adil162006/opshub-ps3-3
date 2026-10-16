import { ApiError as AppError } from '../../lib/ApiError.js';
import { createExport, importInventory } from './reports.service.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');

function checkSiteId(req) {
  if (!isUuid(req.params.siteId)) throw new AppError(400, 'siteId must be a valid UUID');
}

export async function exportReport(req, res) {
  checkSiteId(req);
  const { buffer, filename } = await createExport(req.params.siteId, req.user.id, req.params.resource);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

export async function importInventoryWorkbook(req, res) {
  checkSiteId(req);
  const result = await importInventory(req.params.siteId, req.user.id, req.body);
  res.json(result);
}
