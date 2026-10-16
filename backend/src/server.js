import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import requestRoutes from './modules/requests/requests.routes.js';
import approvalRoutes from './modules/approvals/approvals.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors({ origin: true }));
app.use(express.json());
app.use('/api', analyticsRoutes);
app.use('/api', requestRoutes);
app.use('/api', approvalRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
