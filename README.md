# OpsHub

OpsHub is a configuration driven operations hub for multiple sites. A shared React application renders site pages from enabled modules and typed connections. An Express API and PostgreSQL database provide authentication, site configuration, and operational records.

## Project status

This is a working project prototype, not a production-hardened multi-tenant service. The frontend uses the backend API for site configuration and operational records; it has no browser-local demo database. PostgreSQL row-level security (RLS), backend integration tests, and a deployed service are not in place. See [features.md](features.md) for the delivery checklist and [docs/architecture.md](docs/architecture.md) for boundaries and flows.

## Quick start

Requirements: Node.js 20+ and PostgreSQL. Use separate terminals.

```powershell
# Terminal 1: backend
cd backend
npm install
Copy-Item .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, and seed admin credentials
npm run db:migrate
npm run db:seed
npm run dev

# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000` for the API and Vite serves at `http://localhost:5173`. Set `VITE_BACKEND_URL` in the frontend environment if the API uses another URL. `CORS_ORIGINS` must include the frontend origin. In production cross-site deployments, use HTTPS and set `AUTH_COOKIE_SAME_SITE=none`.

The seed command creates the module catalog, example sites/configurations, optional global administrator, and demo operational records. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `backend/.env`; the password must contain at least six characters. SMTP settings are needed for user invitation flows.

## Commands

From repository root:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
```

From `backend/`: `npm run dev`, `npm run db:migrate`, `npm run db:seed`, `npm run db:generate`, `npm run db:push`, and `npm run db:studio`. The backend `npm test` script is a placeholder and fails intentionally; it is not a test suite.

## Documentation

- [Architecture](docs/architecture.md): components, trust boundaries, module catalog, and deployment shape.
- [API reference](docs/api.md): implemented routes, authentication, request formats, and errors.
- [Setup and operations](docs/setup.md): local configuration, migration, seed, and troubleshooting.
- [Data model](docs/data-model.md): canonical Drizzle tables, relations, and tenant scoping.
- [Workflows](docs/workflows.md): request, approval, assignment, inventory, consumption, return, and repair lifecycles.
- [Feature status](features.md): implemented work and known gaps.

## Source of truth

The approved frontend module types, typed connections, defaults, presets, and configuration validation live in `frontend/src/lib/registry.js`. Runtime site configuration and operational records come from the backend API; there is no browser-local demo database. The canonical database schema is `backend/src/db/schema/`, with migrations in `backend/drizzle/`. `frontend/docs/schema.sql` is a pointer to the backend schema; it is not a standalone migration.
