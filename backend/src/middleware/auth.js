import { verifyToken } from '../lib/jwt.js';

export function requireAuth(req, res, next) {
  const origin = req.get('origin');
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }

  const token = req.cookies?.token;
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
