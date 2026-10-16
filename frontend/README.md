# OpsHub — one codebase, many operations sites

Config-driven multi-site prototype built with React, Vite, Tailwind, React Router, Zustand, React Flow, Recharts, and SheetJS. Login, current-user restoration, permitted-site discovery, and live site themes use the Express backend. The remaining module workflow/data screens still use the browser-local prototype API.

```bash
npm install
npm run dev              # http://localhost:5173
npm run test:isolation   # 50 site_id / RBAC / transaction tests (also in-app: Tests page)
npm run build
```

Routes use browser history, so site URLs look like `/s/central-stores` instead of `/#/s/central-stores`. Production hosting must rewrite unknown paths to `index.html` so direct links and refreshes work.

The module API layer (`src/lib/api.js`) is a simulated REST backend running in the browser (localStorage). The authentication and site APIs use the Express backend and PostgreSQL.

## Backend authentication

Set `VITE_BACKEND_URL` when the API is not running at `http://localhost:3000`. Configure `AUTH_COOKIE_SAME_SITE` (`lax` by default; use `none` with HTTPS for cross-site deployments) and `CORS_ORIGINS` in the backend. Authentication uses an HttpOnly cookie and credentialed requests; the frontend never stores or reads the auth token. Configure the backend's `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before running its database seed to create the global administrator. Regular users and their site memberships must be provisioned in the backend; the former browser-only demo credentials are not backend accounts.

After login, the hub and site switcher use the authenticated site's backend membership and role. Switching to a site loads its published configuration and applies its backend theme through the Zustand site store. Builder and module data operations are outside this integration and still depend on the separate browser-local prototype API; they need a follow-up migration before they work with backend accounts.

## Layout
`src/lib/registry.js` 13 modules as typed nodes, presets, validation · `api.js` backend · `seed.js` demo data · `isolation.js` tests · `src/views/*` module renderers · `src/pages/*` hub, builder, catalogue.
