# OpsHub feature status

## Summary

The frontend is a feature-rich prototype for the OpsHub problem statement, but it does **not yet meet the full delivery requirements**. Its API, authentication, persistence, workflows, and isolation checks run in the browser against seeded `localStorage` data. They are not backed by a running Express/PostgreSQL service. The backend package and database connection are scaffolding only.

Status labels:

- **Made (frontend prototype):** implemented in the browser-based demo; not evidence of a production backend.
- **Partial:** a UI or prototype exists, but the requirement is incomplete or not consistently available.
- **Pending:** not implemented.

## Made in the frontend prototype

- One sign-in screen, seeded demo users, a hub showing the three example sites, and a site switcher.
- Site-specific seeded themes, layouts, configurations, sample records, and role memberships.
- A registry containing all 13 approved module types, with input/output types, dependencies, defaults, and three presets.
- A React Flow builder with a module palette, drag-and-drop, typed connections, configuration validation, field editing, approval-step editing, and theme controls.
- Configurable fields and calculated fields, including examples such as `qty * price`, with validation in the prototype.
- Draft preview, publish validation, numbered releases, release history, and rollback in browser state.
- Prototype screens for inventory, requests, approvals, assignments, assignment/field view, consumption, returns, PCB repair, analytics, reports, access, and members.
- A simulated request → approval → assignment flow with stock decrement and rollback-on-error semantics in the in-memory transaction layer.
- Recharts dashboards, and browser-based Excel export plus inventory import/upsert with role checks in the simulated API.
- Seeded demo data, browser-based JSON backup/restore/reset, and a frontend isolation/RBAC test suite.

The frontend README describes the prototype and demo accounts: [frontend/README.md](frontend/README.md). The module registry and simulated API are in `frontend/src/lib/registry.js` and `frontend/src/lib/api.js`.

## Frontend gaps and limitations

- **Published configuration does not fully drive site navigation.** `SiteRoute.jsx` filters generated pages through a hard-coded per-slug allowlist. Modules enabled in the builder can therefore be missing from the live site's navigation and renderer. This prevents the stated “enable Returns on Distribution, publish, and reload” demo from being reliably satisfied.
- **Admin navigation is hidden.** The shell currently exposes only the Hub link; Builder, Users, Catalogue, Tests, and Backup routes are not linked in the visible navigation.
- **The API and identity flow are simulated.** Requests are handled synchronously in browser code and data is stored in `localStorage`; JWT signing/verification and bcrypt demo hashes in the frontend are not a substitute for server-side authentication or authorization.
- **Browser-local data is not shared or durable across users/devices.** There is no server-backed site provisioning, shared database, or deployment service.
- **Prototype isolation tests do not prove database isolation.** They exercise the simulated API only; PostgreSQL row-level security, ORM scoping, and cross-site database references remain unverified.
- **The current schema target is incomplete.** `frontend/docs/schema.sql` defines only a subset of the data model and enables row-level security only for inventory. It does not yet define and secure every business table required by the feature set.
- **Proposal documentation is incomplete.** The in-app catalogue gives an architecture overview, module list, API outline, and abbreviated schema, but the requested complete architecture diagram, data model/API design, and project README still need to be delivered and aligned with the real backend.
- **No end-to-end tests exercise a real browser-to-API-to-PostgreSQL deployment.**

## Backend: implementation in progress

The backend now has an Express service, Drizzle schema/migrations, server-issued JWT authentication, role checks, site configuration lifecycle endpoints, and service modules for the operational workflows. It has not yet been validated against a running PostgreSQL instance, and it is not wired to the frontend's default browser-local API.

- [x] Implement Express startup, environment loading, configurable CORS origins, liveness/readiness endpoints, centralized errors, and graceful database shutdown.
- [x] Define Drizzle tables and migrations for users, sites, site memberships, versions/deploy history, inventory, requests, approvals, assignments, consumption, returns, repairs, reports jobs, and audit data.
- [x] Implement server-side password hashing, JWT issuance/verification, authentication middleware, and database-backed role checks.
- [x] Implement REST routes for login/current user; sites; draft, publish, preview, versions, rollback; global users and site members; and the operational resources.
- [x] Scope service queries by site and use same-site foreign keys for business record references.
- [x] Implement approval-chain transitions, assignment, consumption, returns, and repair lifecycle services.
- [x] Make assignment stock decrement, request state change, stock movement, and assignment creation transactional with row locks and quantity guards.
- [x] Persist draft and published configuration as JSONB, validate module connections/fields, and store versioned publish/rollback history.
- [x] Implement role-restricted spreadsheet export and atomic inventory import paths.
- [x] Provide backend environment example, setup documentation, repeatable migrations, and initial site configuration seeding.
- [ ] Enforce tenant isolation in PostgreSQL with row-level security on every business table. API-level site scoping and same-site foreign keys are present, but database RLS policies are not yet installed.
- [ ] Connect the frontend to the real HTTP API and PostgreSQL-backed authentication/data; deployed behavior still relies on the browser simulator.
- [ ] Add backend unit/integration tests for authentication, permissions, endpoint coverage, transaction rollback/concurrency, and cross-site isolation against PostgreSQL. The backend `test` script remains a placeholder.
- [ ] Verify the migrations and seed against a real PostgreSQL instance and complete the browser-to-API-to-database demo.

## Delivery checks still required

- [ ] Verify that publishing a module change makes its page available from configuration alone, without site-slug-specific frontend code or a restart.
- [ ] Demonstrate the same three sites using a shared backend and database while proving cross-site reads and writes are denied at both API and database levels.
- [ ] Complete the supplied live-demo script, including enabling Returns on Distribution and role-restricted Excel import/export against the real service.
- [ ] Finish and validate the architecture diagram, complete module registry mapping, data model/API design, and README against the implemented system.
- [ ] Run the full frontend build and prototype tests, plus backend and end-to-end tests after the server implementation is complete.
