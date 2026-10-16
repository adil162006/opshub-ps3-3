# OpsHub backend

Express 5 API backed by PostgreSQL and Drizzle ORM. Run these commands from the repository root unless noted.

## Local setup

1. Create a PostgreSQL database and copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL`, a private `JWT_SECRET` (at least 32 random bytes), and the frontend origins in `CORS_ORIGINS`.
3. From `backend/`, run `npm install`, then `npm run db:migrate` and `npm run db:seed`.
4. Optionally configure `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding to create the initial global administrator. The password must be at least 12 characters.
5. Run `npm run dev` in `backend/`. The liveness endpoint is `GET /health`; `GET /ready` also checks PostgreSQL.

Set SMTP values before creating users through the user management API. Account creation sends a welcome email and is rolled back if delivery fails.

## Database changes

Edit `src/db/schema/`, generate a migration with `npm run db:generate`, and apply it with `npm run db:migrate`. `npm run db:push` is intended for local schema iteration. Seed after migrations; the seed script creates the module catalog, the three example sites, their initial published configurations, and an optional administrator.

## API notes

- Authenticated requests use `Authorization: Bearer <token>`.
- Site business routes take a site UUID. Services scope queries by site, and same-site foreign keys prevent cross-site references. PostgreSQL row-level security policies have not been added yet.
- The initial configuration supports the 13 approved module types from the frontend registry. Site drafts are validated against that registry before publish.
- `POST /api/:siteId/import/inventory` accepts JSON `{ "rows": [...] }`; the report import path also accepts an `.xlsx` body.
- `GET /health` is liveness only. Use `/ready` to confirm the database connection.

The frontend still uses its browser-local simulator by default; a production browser-to-API integration is a separate remaining delivery step.
