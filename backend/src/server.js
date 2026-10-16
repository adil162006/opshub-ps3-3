import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors({ origin: true }));
app.use(express.json());
app.use('/api', analyticsRoutes);
app.use('/api', inventoryRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
