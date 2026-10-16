export function errorHandler(error, _req, res, _next) {
  if (error?.code === '23505' || error?.code === '23503') {
    return res.status(409).json({ status: 409, message: 'A record with these values already exists' });
  }
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  const body = { status, message: status >= 500 ? 'Internal server error' : error.message };
  if (error?.details !== undefined) body.details = error.details;
  return res.status(status).json(body);
import { ApiError } from '../lib/ApiError.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ status: err.statusCode, message: err.message, ...(err.errors?.length ? { details: err.errors } : {}) });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error('[Error]', err);

  if (err.type === 'entity.parse.failed') return res.status(400).json({ status: 400, message: 'Request body contains invalid JSON' });
  if (err.code === '23505') return res.status(409).json({ status: 409, message: 'A record with these values already exists' });
  if (err.code === '23503') return res.status(409).json({ status: 409, message: 'This record is referenced by other data' });
  if (statusCode >= 400 && statusCode < 500) return res.status(statusCode).json({ status: statusCode, message });
  return res.status(500).json({ status: 500, message: 'Internal Server Error' });
}
