# OpsHub — delivered features

## What is built and working

OpsHub is a fully working multi-tenant operations hub. One React + Express codebase runs N completely different sites from a single shared module registry. Every feature listed below is live against the PostgreSQL backend.

### Hub layer
- Single global JWT login with bcrypt password hashing and an HttpOnly cookie session.
- Role matrix: Public, Member, Manager, Admin — enforced at every API route and service layer.
- Hub page lists all sites the authenticated user can access, with per-site theme colours, module tags, and live version number.
- Site switcher navigates between completely different products without a page reload or re-login.
- Global user management for hub administrators.

### Visual site builder (React Flow)
- Module palette with all 13 approved module types grouped by category.
- Drag-and-drop onto the canvas or click to add; drag between node handles to connect.
- Typed connections: the registry enforces which outputs a module produces and which inputs a target requires. Invalid connections are rejected with an explanation.
- Per-node configuration panel: field editor (text, number, select, date, item, calc), approval chain steps, and node label.
- Calculated fields with formula validation (e.g. `qty * price`, `partsCost + labourCost`).
- Three built-in presets: Inventory Starter, Approval Chain, Repair Shop.
- Theme editor: primary colour, accent colour, layout (sidebar / topbar), mode (light / dark), font, density, and corner radius.
- Draft auto-save with debounce; explicit Save draft and Publish buttons.
- Preview draft before publishing — renders the unpublished configuration at `/preview/:slug`.
- Publish creates a numbered versioned release stored in the database.
- Rollback to any previous published version in one click; the canvas updates immediately.
- Deploy history log showing every publish and rollback with actor and timestamp.

### Configuration-driven renderer
- `SiteRoute.jsx` renders every site's pages, navigation, and layout entirely from the saved module configuration — no slug-specific code paths.
- Switching sites changes layout, theme, navigation items, available modules, and data scope.
- Adding a module to a live site, publishing, and reloading the browser activates it with no code changes and no server restart.

### All 13 approved modules
| Module | Status |
|---|---|
| Authentication & RBAC | ✅ Global JWT login, bcrypt, role matrix |
| User Management | ✅ Site members, role assignment, invitation flow |
| Dashboard Shell / Navigation / Forms | ✅ Themed layout, sidebar and topbar, config-driven forms |
| Inventory | ✅ Stock CRUD, search, calculated total, reorder alerts |
| Request | ✅ Configurable form, item field links to Inventory |
| Approval | ✅ Multi-step chain, per-step role, decision log |
| Material Assignment | ✅ Transactional stock decrement, request state update |
| Assignment Frontend | ✅ Field-facing cards with usage progress bar |
| Consumption Tracking | ✅ Log usage against assignment items |
| Return Management | ✅ Material returns (restock) and repaired-device returns |
| PCB Repair | ✅ diagnosis → repairing → testing → completed lifecycle, parts cost |
| Analytics Dashboard | ✅ Per-site Recharts charts driven by enabled modules |
| Reports with Excel Integration | ✅ Role-restricted export (Member+) and import (Manager+) |

### Operational workflows
- Request → Approval → Assignment with a single transactional write: stock decrement, stock movement record, request status change, and assignment row all commit or all roll back together.
- Consumption records usage against assignment items with remaining-quantity tracking.
- Returns handle both material returns from assignments and completed-repair device handoffs.
- Repair lifecycle enforces the four-stage progression with parts cost tracking.

### Data isolation
- Every business table carries `site_id`. Service queries scope all reads and writes to the authenticated user's site membership.
- Same-site composite foreign keys prevent cross-site record references at the database constraint level.
- Role checks are enforced in middleware and repeated in service layer before any write.

### Analytics and reporting
- Per-site analytics page renders only the charts relevant to the site's enabled modules (inventory value, low-stock SKUs, requests by status, assignments, consumption trend, repair stages).
- Analytics endpoint aggregates data server-side; charts update after every workflow action.
- Excel export produces a formatted XLSX workbook for any resource; import performs an atomic upsert by SKU.

### Demo data
- Three fully seeded sites: Central Stores (inventory + analytics), Service Centre (repair workflow), Distribution (field assignment + consumption).
- Realistic electronics-industry data: PCB boards, capacitors, ICs, relays, connectors.
- Seeded operational records cover the full workflow: open requests, approved requests, active repairs at different stages, an in-use assignment with partial consumption, and a pending return.
- One-command reseed: `node newSeed.js` from the `backend/` directory resets all demo records without dropping the schema.

## Backend delivery checklist

- [x] Express startup, environment loading, configurable CORS origins, health/readiness endpoints, centralized errors, and graceful shutdown.
- [x] Drizzle schema and migrations for users, sites, memberships, versions, deploy history, all operational tables, Excel jobs, and audit logs.
- [x] Server-side password hashing, JWT issuance, and database-backed role checks.
- [x] REST routes for auth, sites/configuration lifecycle, users/members, and all operational resources.
- [x] Site-scoped queries and same-site composite foreign keys.
- [x] Approval, assignment, consumption, return, and repair lifecycle services.
- [x] Transactional assignment stock decrement and request state changes.
- [x] Versioned draft/published configuration with validation and rollback.
- [x] Role-restricted Excel export and inventory import.
- [x] Health (`/health`) and readiness (`/ready`) endpoints.

## Roadmap (post-hackathon)

- PostgreSQL row-level security policies on every business table for defence-in-depth database isolation.
- Backend integration test suite covering auth, permissions, transaction rollback, and cross-site isolation proofs.
- Deployment manifests and a hosted environment.
