# Frontend

React 18 and Vite client for OpsHub. The module registry and configuration validation are in `src/lib/registry.js`; routes and views are under `src/pages/` and `src/views/`.

From this directory:

```bash
npm install
npm run dev
npm run build
npm run test:isolation
```

The client defaults to the backend at `http://localhost:3000`; set `VITE_BACKEND_URL` to override it. UUID-backed sites use the HTTP API for site configuration and operational data. Non-UUID example sites and simulator/isolation flows use browser-local demo state. The simulator is not shared, durable server storage.

See the repository [README](../README.md), [architecture](../docs/architecture.md), [API reference](../docs/api.md), and [feature status](../features.md). The isolation suite tests the frontend simulator only, not the PostgreSQL API.
