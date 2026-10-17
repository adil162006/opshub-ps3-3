# Frontend

React 18 and Vite client for OpsHub. The module registry and configuration validation are in `src/lib/registry.js`; routes and views are under `src/pages/` and `src/views/`.

From this directory:

```bash
npm install
npm run dev
npm run build
```

The client defaults to the backend at `http://localhost:3000`; set `VITE_BACKEND_URL` to override it. All site configuration and operational data comes from the backend API. There is no frontend seed database or browser-local data fallback.

`src/lib/registry.js` defines the approved frontend modules, their typed connections, defaults, presets, and configuration validation. Backend operational records and seed data are maintained on the server. See the repository [README](../README.md), [architecture](../docs/architecture.md), [API reference](../docs/api.md), and [feature status](../features.md).
