# Backend

Express 5 API backed by PostgreSQL and Drizzle ORM. See the repository [setup guide](../docs/setup.md), [API reference](../docs/api.md), [architecture](../docs/architecture.md), and [data model](../docs/data-model.md).

From this directory, copy `.env.example` to `.env`, configure the database, JWT secret, CORS origins and (optionally) initial admin credentials, then run:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The service listens on port 3000 by default. `GET /health` is liveness and `GET /ready` checks database readiness. `npm test` is still a placeholder; no backend test suite is included. PostgreSQL RLS is not yet configured.
