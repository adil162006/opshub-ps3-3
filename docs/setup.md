# Local setup and operations

## Requirements

- Node.js 20 or later (the current project has also been run under Node 24).
- PostgreSQL database reachable from the backend.
- npm.

## Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`:

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: random secret of at least 32 bytes.
- `CORS_ORIGINS`: comma-separated exact browser origins, usually `http://localhost:5173,http://127.0.0.1:5173` for local work.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: optional first global admin used by the seed. Use a strong local password; the script currently requires at least six characters.
- SMTP fields: required for account invitation email flows.

Run from `backend/`:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

The seed command runs `prepareSeedDatabase.js`, the base catalog/site seed, and the operational demo seed. It can baseline a database that already has the schema pushed by Drizzle, then applies migrations. It is designed to be repeatable for the included demo data. Use `npm run db:push` only for local schema iteration; commit generated migrations for reproducible environments.

Check `http://localhost:3000/health` for process liveness and `/ready` for database readiness.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The default backend URL is `http://localhost:3000`. Configure `VITE_BACKEND_URL` before building if it differs. Vite's history fallback must be configured on the production host so direct site URLs resolve to `index.html`.

## Frontend commands

From repository root:

```bash
npm --prefix frontend run build
npm --prefix frontend run test:isolation
```

The build checks frontend compilation. Isolation tests exercise the browser simulator only; they do not validate PostgreSQL, API integration, or database tenant isolation.

## Database change procedure

1. Modify the relevant files in `backend/src/db/schema/`.
2. Run `npm run db:generate` in `backend/` and review generated SQL.
3. Apply with `npm run db:migrate` against a development database.
4. Update service code, seed data, API docs, and data model docs in the same change.

## Common issues

- **`column ... does not exist`:** the database schema and checked-out migration state do not match. Review applied migrations and run `npm run db:migrate`; do not patch the seed to query columns absent from the canonical Drizzle schema.
- **CORS or cookie session failures:** ensure `CORS_ORIGINS` exactly matches the page origin and the frontend uses credentialed API requests. For cross-site production, use HTTPS and `AUTH_COOKIE_SAME_SITE=none`.
- **`/ready` fails:** check database availability and `DATABASE_URL`; `/health` does not check PostgreSQL.
- **Invitation email fails:** set SMTP host, port, credentials, sender, and provider configuration.
- **Demo slug is rejected by backend:** API operational routes require UUID site IDs. Non-UUID sample sites are served by the browser simulator.

## Current operational limits

No backend integration test suite, RLS policies, or deployment manifests are provided. Do not treat the placeholder backend `npm test` as passing. No production deployment is configured by this repository.
