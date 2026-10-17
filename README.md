# OpsHub

OpsHub is a configuration-driven operations hub for multiple sites. A shared React application renders each site's pages from enabled modules and typed connections. An Express API and PostgreSQL database provide authentication, site configuration, and operational records.

## Project status

OpsHub is a working prototype, not a production-hardened multi-tenant service. The frontend uses the backend API; it has no browser-local operational database. PostgreSQL row-level security (RLS), backend integration tests, and a deployed end-to-end environment are not yet in place. See [the feature checklist](features.md) for implementation status and [the architecture guide](docs/architecture.md) for system boundaries.

## Quick start

Requirements: Node.js 20 or later, npm, and a PostgreSQL database reachable by the backend. Use separate terminals. Follow [the full setup guide](docs/setup.md) for environment variables and seed behavior.

```powershell
# Terminal 1 — backend
Set-Location backend
npm install
Copy-Item .env.example .env
# Edit .env with a database URL, a strong JWT secret, and seed admin credentials.
npm run db:migrate
npm run db:seed
npm run dev

# Terminal 2 — frontend, from the repository root
npm install --prefix frontend
npm --prefix frontend run dev
```

The API defaults to `http://localhost:3000`; Vite defaults to `http://localhost:5173`. The backend CORS allowlist must contain the exact frontend origin. The frontend API client defaults to the local backend; set `VITE_BACKEND_URL` at frontend build time if the API is hosted elsewhere. For cross-site production cookies, use HTTPS and configure `AUTH_COOKIE_SAME_SITE=none`.

The `db:seed` command requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. It also creates the example sites and operational sample data. It can update seeded records and the configured admin account; use a disposable/local demo database, not a database whose existing data must be preserved.

## Useful commands

Run from the repository root:

```powershell
npm --prefix frontend run dev
npm --prefix frontend run build
```

From `backend/`, available commands include `npm run dev`, `npm run db:migrate`, `npm run db:seed`, `npm run db:generate`, `npm run db:push`, and `npm run db:studio`. The backend `npm test` command is a placeholder that exits with an error; it is not a test suite.

## Documentation

Start at the [documentation index](docs/README.md). It links to the architecture, API, setup, data model, workflows, and demo runbook. The [five-minute judge script](docs/judge-demo.md) is the timed presenter version; [features.md](features.md) tracks implementation and outstanding work.

## Sources of truth

- Approved module types, typed connections, defaults, presets, and frontend validation: `frontend/src/lib/registry.js`.
- Canonical database schema: `backend/src/db/schema/`.
- Versioned database migrations: `backend/drizzle/`.
- Runtime site configuration and business records: backend API and PostgreSQL.

`frontend/docs/schema.sql` is a pointer/draft, not a standalone production migration.
