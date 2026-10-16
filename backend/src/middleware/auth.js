import { verifyToken } from '../lib/jwt.js';

export function requireAuth(req, res, next) {
  let token = null;
  const header = req.get('authorization') || '';
  const [scheme, credentials] = header.split(' ');

  if (scheme === 'Bearer' && credentials) {
    token = credentials;
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    const userId = payload.userId || payload.sub || payload.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    req.user = { id: userId, ...payload };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}
