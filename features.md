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

## Backend: pending implementation

The backend is **not implemented**. `backend/src/server.js` has no server or route implementation, and `backend/src/db/index.js` only creates a PostgreSQL pool and Drizzle client. Backend dependencies and database scripts exist, but they do not by themselves provide a working service.

- [ ] Implement and start the Express application, configuration loading, CORS policy, health endpoint, error handling, and graceful database shutdown.
- [ ] Define the Drizzle schema and migrations for users, sites, site memberships, site versions/deploy history, inventory, requests, approvals, assignments, consumption, returns, and repairs.
- [ ] Implement server-side password hashing/verification, JWT issuance and verification, authentication middleware, and the Public/Member/Manager/Admin permission matrix.
- [ ] Implement all required REST routes: login/current user; list/create/read sites; draft, publish, preview, releases, and rollback; global users and site members; and scoped CRUD/workflow routes for every enabled resource.
- [ ] Enforce `site_id` on every business query and write at the API/ORM layer; enforce tenant isolation in PostgreSQL with row-level security on **every** business table and same-site foreign keys.
- [ ] Implement workflow transitions and authorization on the server, including approval-chain steps, assignment, consumption, returns, and repair lifecycle.
- [ ] Make assignment stock decrement, request state changes, and assignment creation a single PostgreSQL transaction; handle concurrent assignments safely and test rollback and insufficient-stock cases.
- [ ] Persist builder JSON configuration as JSONB; validate typed module connections and field schemas server-side; implement versioned publish, preview, rollback, and deploy history.
- [ ] Implement validated, role-restricted Excel import/export endpoints, including atomic inventory upsert behavior.
- [ ] Connect the frontend to the real HTTP API and PostgreSQL-backed authentication/data; remove reliance on the simulated API for deployed behavior while retaining an explicit demo/offline mode if required.
- [ ] Add backend unit/integration tests for authentication, roles, endpoint coverage, transactions, and cross-site isolation against PostgreSQL. The current backend `test` script is only a placeholder.
- [ ] Provide repeatable local setup, environment-variable documentation/example, migrations/seeding, and an offline demo backup.

## Delivery checks still required

- [ ] Verify that publishing a module change makes its page available from configuration alone, without site-slug-specific frontend code or a restart.
- [ ] Demonstrate the same three sites using a shared backend and database while proving cross-site reads and writes are denied at both API and database levels.
- [ ] Complete the supplied live-demo script, including enabling Returns on Distribution and role-restricted Excel import/export against the real service.
- [ ] Finish and validate the architecture diagram, complete module registry mapping, data model/API design, and README against the implemented system.
- [ ] Run the full frontend build and prototype tests, plus backend and end-to-end tests after the server implementation is complete.
