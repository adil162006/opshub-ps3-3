export function errorHandler(error, _req, res, _next) {
  if (error?.code === '23505' || error?.code === '23503') {
    return res.status(409).json({ status: 409, message: 'A record with these values already exists' });
  }
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  const body = { status, message: status >= 500 ? 'Internal server error' : error.message };
  if (error?.details !== undefined) body.details = error.details;
  return res.status(status).json(body);
}
