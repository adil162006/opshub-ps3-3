# OpsHub feature status

## Summary

The frontend uses the backend API for authentication, site configuration, and operational records. It contains no browser-local operational database, demo seed records, or simulator fallback. PostgreSQL row-level security, backend integration tests, and a deployed service setup remain pending. See the guides linked from [README](README.md).

## Implemented

- A shared frontend module registry at `frontend/src/lib/registry.js` defines the approved 13 module types, typed connections, defaults, presets, page metadata, and configuration validation.
- The React Flow builder supports module setup, typed connections, configuration validation, field editing, approval steps, themes, draft preview, publish, release history, and rollback through backend site APIs.
- Site navigation and rendered pages derive from enabled modules in the saved site configuration.
- Operational views call backend APIs for inventory, requests, approvals, assignments, consumption, returns, repairs, analytics, and reports.
- The backend provides Express routes, Drizzle schema/migrations, server-issued authentication, role checks, and service modules for operational workflows.
- Backend seed scripts provide optional development users, sites/configurations, and operational records. Those records are server-side only.

## Remaining gaps

- PostgreSQL row-level security is not installed. Tenant isolation currently relies on API/service checks and same-site relational constraints.
- Backend integration tests for authentication, permissions, transaction rollback/concurrency, and cross-site isolation remain pending. The backend `test` script is a placeholder.
- No deployed service or browser-to-API-to-database end-to-end environment is configured.

## Backend delivery checklist

- [x] Express startup, environment loading, configurable CORS origins, health/readiness endpoints, centralized errors, and graceful database shutdown.
- [x] Drizzle tables and migrations for users, sites, memberships, versions/deploy history, operational records, reports jobs, and audit data.
- [x] Server-side password hashing, authentication, and database-backed role checks.
- [x] REST routes for authentication, sites/configuration lifecycle, users/members, and operational resources.
- [x] Site-scoped queries and same-site foreign keys for business record references.
- [x] Approval, assignment, consumption, return, and repair lifecycle services.
- [x] Transactional assignment stock decrement and request state changes.
- [x] Versioned draft/published configuration with validation and rollback.
- [x] Role-restricted workbook export and inventory import paths.
- [ ] Enforce tenant isolation in PostgreSQL with RLS on every business table.
- [ ] Add backend integration coverage and verify browser-to-API-to-database workflows.

## Delivery checks still required

- [x] Render pages and navigation from enabled module configuration without slug-specific behavior.
- [ ] Prove cross-site reads and writes are denied at both API and database levels.
- [ ] Complete the live workflow demonstration and role-restricted import/export against the real service.
- [ ] Deploy a shared backend and database and verify the full flow.
