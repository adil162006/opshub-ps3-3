# OpsHub — delivered features

This file tracks the implemented prototype and its known delivery gaps. It is not a certification of production readiness. See the [documentation index](docs/README.md) for architecture, API, setup, data-model, workflow, and demo guides.

## Product summary

OpsHub is a configuration-driven, multi-site operations hub. A shared React frontend renders pages from a site's published configuration; an Express API and PostgreSQL backend provide authentication, versioned site configuration, and operational records. The frontend has no browser-local operational database or simulator. Optional demo records are seeded into PostgreSQL by the backend.

### Hub layer
- Single global JWT login with bcrypt password hashing and an HttpOnly cookie session.
- Role matrix: Public, Member, Manager, Admin — enforced at every API route and service layer.
- Hub page lists all sites the authenticated user can access, with per-site theme colours, module tags, and live version number.
- Site switcher navigates between completely different products without a page reload or re-login.
- Global user management for hub administrators.

- **Module configuration:** a registry of 13 approved modules, typed inputs/outputs, defaults, presets, field definitions, client configuration validation, plain-language connection guidance, and configurable site background color in the visual builder.
- **Visual builder:** React Flow module canvas, typed connections, validation feedback, field and approval-step editing, themes, draft persistence, draft preview, publish, release history, and rollback.
- **Configuration-driven runtime:** site navigation and page rendering derive from enabled modules and published site configuration rather than slug-specific feature branches.
- **Identity and access:** backend-issued JWT in an HttpOnly cookie, password hashing, active-account checks, global administrator operations, site membership, and service-level role checks.
- **Site API:** site discovery, site creation/deletion, draft/published config lifecycle, members and user-management routes.
- **Operational API and views:** inventory/categories/stock movements; requests/approvals; assignments; consumption; returns; repairs; analytics; Excel import/export.
- **Workflow integrity:** assignment stock changes and request updates use a transaction; consumption and repair lifecycle operations also use transactional service logic.
- **Persistence:** Drizzle PostgreSQL schema and versioned SQL migrations for identity, site configuration, operations, reporting jobs, and audit records.
- **Optional demo data:** backend seed scripts create sample sites/configurations, staff, inventory and operations data in the configured database.
- **Documentation:** local setup, API routes, architecture, data model, operational workflows, and a five-minute judge presentation/runbook.

## Known gaps and non-goals

- **No database RLS:** PostgreSQL row-level security is not installed. Site-scoped service queries and selected same-site foreign keys do not provide complete database-enforced tenant isolation.
- **No backend integration suite:** authentication, role enforcement, transaction rollback/concurrency, and cross-site isolation require real automated integration coverage. The backend `npm test` script is a placeholder that exits with an error.
- **No deployed end-to-end environment:** a shared deployment that exercises browser → API → PostgreSQL is not configured in this repository.
- **Prototype hardening remains:** production operations require reviewed deployment, secrets, HTTPS/cookie configuration, backups, monitoring, and data-retention procedures.
- **No claim of production readiness:** do not present this prototype as having completed RLS, isolation testing, or operational deployment.

## Delivery checklist

### Application and workflows

- [x] Render navigation and pages based on enabled published modules.
- [x] Validate approved module types and typed configuration connections in the builder.
- [x] Explain each module's required and optional connections in plain language before publishing.
- [x] Save drafts, preview drafts, publish versioned configuration, view releases, and roll back.
- [x] Implement site-aware authentication, role checks, and operational APIs.
- [x] Implement request, approval, assignment, stock movement, consumption, return, and repair service flows.
- [x] Provide optional backend seed data for local/demo environments.

### Reliability and tenant isolation

- [x] Add site identifiers to business records and same-site constraints for selected relational references.
- [x] Scope current service queries to the requested site and check site membership/role where required.
- [ ] Add PostgreSQL RLS policies for every applicable business table and test direct database access boundaries.
- [ ] Add backend integration tests for auth, role policy, site isolation, transaction rollback, and concurrency.
- [ ] Verify cross-site read/write denial through API and database-level tests.
- [ ] Configure and verify a deployed browser-to-API-to-database environment.
- [ ] Complete production security, operations, backup, monitoring, and recovery review.

## Demo and verification

Use [the five-minute judge script](docs/judge-demo.md) and [the pre-demo runbook](docs/demo-runbook.md). The sample data is optional and must be verified in the database being presented. Run `npm --prefix frontend run build` to validate frontend compilation. Do not report the backend placeholder `npm test` as a passing test suite.
