import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { pool } from './db/index.js';
import usersRoutes from './modules/users/users.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import assignmentsRoutes from './modules/assignments/assignments.routes.js';
import consumptionRoutes from './modules/consumption/consumption.routes.js';
import requestsRoutes from './modules/requests/requests.routes.js';
import approvalsRoutes from './modules/approvals/approvals.routes.js';
import returnsRoutes from './modules/returns/returns.routes.js';
import repairsRoutes from './modules/repairs/repairs.routes.js';
import sitesRoutes from './modules/sites/sites.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = Number(process.env.PORT) || 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

const isLocalOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalOrigin(origin)) return callback(null, true);
    console.warn(`[CORS] Rejected origin: "${origin}"`);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/ready', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ready' }); }
  catch (error) { next(error); }
});

app.use('/api', analyticsRoutes);
app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', reportsRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', assignmentsRoutes);
app.use('/api', consumptionRoutes);
app.use('/api', requestsRoutes);
app.use('/api', approvalsRoutes);
app.use('/api', returnsRoutes);
app.use('/api', repairsRoutes);
app.use('/api', sitesRoutes);

// Catch 404
app.use((req, res) => {
  res.status(404).json({ status: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

export const server = pathToFileURL(process.argv[1] || '').href === import.meta.url
  ? app.listen(port, () => console.log(`OpsHub backend listening on port ${port}`))
  : null;

if (server) {
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received; closing OpsHub backend`);
    server.close(async (error) => {
      if (error) console.error('HTTP server shutdown failed:', error);
      try { await pool.end(); process.exit(error ? 1 : 0); }
      catch (dbError) { console.error('PostgreSQL pool shutdown failed:', dbError); process.exit(1); }
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
