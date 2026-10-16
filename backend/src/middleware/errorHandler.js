export function errorHandler(error, _req, res, _next) {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 400, message: 'Request body contains invalid JSON' });
  }
  if (error?.code === '23505') return res.status(409).json({ status: 409, message: 'A record with these values already exists' });
  if (error?.code === '23503') return res.status(409).json({ status: 409, message: 'This record is referenced by other data' });

  const status = Number.isInteger(error?.statusCode) ? error.statusCode
    : Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error('[Error]', error);
  const body = { status, message: status >= 500 ? 'Internal server error' : error.message || 'Request failed' };
  const details = error?.errors?.length ? error.errors : error?.details;
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}
