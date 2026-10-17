# OpsHub documentation

This index links to the project guides and identifies the source of truth for each area.

## Project overview

- [Feature status](../features.md) — implemented capabilities, known gaps, and delivery checklist.
- [Architecture](architecture.md) — application components, request path, trust boundaries, and deployment considerations.
- [Data model](data-model.md) — canonical PostgreSQL entities, site scoping, and relationships.

## Development and integration

- [Local setup and operations](setup.md) — prerequisites, environment variables, migrations, seeds, and troubleshooting.
- [HTTP API reference](api.md) — current routes, authentication, aliases, and operational boundaries.
- [Operational workflows](workflows.md) — request, approval, assignment, inventory, consumption, return, repair, and publish lifecycles.

## Presentation

- [Five-minute judge script](judge-demo.md) — timed presenter narration and screen-by-screen route.
- [Judge demo runbook](demo-runbook.md) — environment preparation, preflight checks, seed-data verification, and recovery tips.

## Code sources of truth

- Frontend module definitions and configuration validation: `frontend/src/lib/registry.js`.
- Frontend site rendering and views: `frontend/src/pages/SiteRoute.jsx` and `frontend/src/views/`.
- Backend routes and services: `backend/src/modules/`.
- Canonical Drizzle schema and migrations: `backend/src/db/schema/` and `backend/drizzle/`.

Keep the guides aligned with those sources. The backend `npm test` command is a placeholder, PostgreSQL RLS is not configured, and the repository does not include a deployed end-to-end environment.
