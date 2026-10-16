import { verifyToken } from '../lib/jwt.js';

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = verifyToken(token);
    const userId = payload.userId || payload.sub || payload.id;
    if (!userId) return res.status(401).json({ error: 'Invalid authentication token' });
    req.user = { id: userId };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}
