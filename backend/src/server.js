import 'dotenv/config';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import usersRoutes from './modules/users/users.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import assignmentsRoutes from './modules/assignments/assignments.routes.js';
import consumptionRoutes from './modules/consumption/consumption.routes.js';
import repairsRoutes from './modules/repairs/repairs.routes.js';

import requestsRoutes from './modules/requests/requests.routes.js';
import approvalsRoutes from './modules/approvals/approvals.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', reportsRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', requestsRoutes);
app.use('/api', approvalsRoutes);
app.use('/api', assignmentsRoutes);
app.use('/api', consumptionRoutes);
app.use('/api', repairsRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', reportsRoutes);

// Catch 404
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`OpsHub backend listening on port ${port}`);
});

export default app;
