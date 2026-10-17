# Local setup and operations

This guide starts the local frontend and API against PostgreSQL. For presenter-specific checks, see the [demo runbook](demo-runbook.md).

## Requirements

- Node.js 20 or later and npm.
- PostgreSQL reachable from the backend.
- Two terminals for the long-running development servers.

## Configure the backend

From the repository root, prepare the backend environment:

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` with values for:

| Variable | Requirement |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for a database created for this app. |
| `JWT_SECRET` | Cryptographically random secret of at least 32 bytes. Do not reuse a checked-in or sample value. |
| `CORS_ORIGINS` | Comma-separated exact browser origins. Local defaults are `http://localhost:5173,http://127.0.0.1:5173`. |
| `SEED_ADMIN_EMAIL` | Valid email for the local/demo global administrator. Required by the current full seed command. |
| `SEED_ADMIN_PASSWORD` | Local/demo admin password. Required by the current full seed command; use a strong unique value. |
| `SEED_ADMIN_NAME` | Optional display name for the seeded administrator. |

The full seed command updates the configured administrator's credentials/profile and inserts or upserts sample data. Do not run it against a database whose records or admin account you need to preserve.

SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and optionally `SMTP_FROM_NAME`) are needed for invitation email flows. Configure them only when testing email-dependent flows.

## Migrate and seed

Run from `backend/`:

```powershell
npm run db:migrate
npm run db:seed
```

`db:seed` runs `prepareSeedDatabase.js`, the base catalog/site seed, and the operational demo seed. The preparation step applies migrations and can baseline a pre-existing schema if the expected tables are already present. A missing/incomplete pre-existing schema is an error; back up important data before schema operations. The included demo records are examples, not fixtures guaranteed to exist in every environment.

For local schema iteration, `npm run db:push` is available, but use reviewed migrations for reproducible schema changes. Generate migrations with `npm run db:generate` and apply them with `npm run db:migrate`.

## Start the API

From `backend/`:

```powershell
npm run dev
```

The API defaults to port `3000`. Check `http://localhost:3000/health` for process liveness and `http://localhost:3000/ready` for database readiness.

## Start the frontend

In a second terminal from the repository root:

```powershell
npm install --prefix frontend
npm --prefix frontend run dev
```

Vite defaults to `http://localhost:5173`; the frontend API client defaults to `http://localhost:3000`. If the API has a different URL, set `VITE_BACKEND_URL` in the frontend build environment. The backend's `CORS_ORIGINS` must include the exact browser origin.

For production cross-site cookies, serve both sides over HTTPS and set `AUTH_COOKIE_SAME_SITE=none`. The backend sets the cookie's `secure` attribute when production mode is active or SameSite is `none`.

## Useful commands

From the repository root:

```powershell
npm --prefix frontend run build
```

From `backend/`: `npm run dev`, `npm run db:generate`, `npm run db:migrate`, `npm run db:push`, `npm run db:seed`, and `npm run db:studio`.

The backend `npm test` script is a placeholder that exits with an error. There is no backend integration test suite in this repository; do not report that command as passing tests.

## Database change procedure

1. Update the relevant Drizzle definitions in `backend/src/db/schema/`.
2. Run `npm run db:generate` from `backend/` and review the generated SQL.
3. Apply the migration against a development database with `npm run db:migrate`.
4. Update service code, seed data, API documentation, and the [data model](data-model.md) in the same change.
5. Validate the frontend build where relevant. Add and run real backend tests when a backend test suite is introduced.

## Troubleshooting

- **`/health` works but `/ready` fails:** check PostgreSQL availability and `DATABASE_URL`; liveness does not imply database readiness.
- **CORS or cookie/session errors:** make sure the page origin exactly matches an entry in `CORS_ORIGINS`; use credentialed requests and matching cookie settings.
- **Login fails after seeding:** verify the configured seed email/password and account state. Running the demo seed may reset the configured admin credentials.
- **`db:seed` rejects admin settings:** set both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`; the operational seed requires both.
- **A column or table is missing:** compare the checked-out migrations with the database's migration state. Do not patch seed code to query a column absent from the canonical schema.
- **A site ID is rejected:** operational routes expect a site UUID. Resolve the site's UUID through the authenticated sites API.
- **Invitation fails:** configure and verify SMTP before testing invitation flows.

## Current operational limits

The repository does not include PostgreSQL RLS policies, a real backend integration test suite, deployment manifests, or a deployed end-to-end environment. API/service role checks and selected same-site constraints are not substitutes for those controls.
