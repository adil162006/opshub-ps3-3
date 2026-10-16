# Backend Integration Guide

## Purpose and source of truth

OpsHub is a multi-site operations application. The React/Vite frontend sends HTTP requests to the Express backend for authentication, site configuration, request creation/reads, workflow inventory reads, approvals, assignments, consumption, and analytics. Inventory CRUD, returns, repairs, reports/import/export, and the non-UUID demo path still use the browser-local prototype API and data store.

Use the real auth and site route implementations for their current contracts. For remaining module operations, use `frontend/src/lib/api.js` as the expected request/response reference, not as evidence that the browser-local simulator is server-enforced. The endpoint table in the frontend catalogue and `frontend/docs/schema.sql` are incomplete. Check the relevant UI and server code before changing a contract.

See the root [`AGENTS.md`](../AGENTS.md) for project-wide product constraints and [`features.md`](../features.md) for implementation status and remaining requirements.

## Relevant frontend behavior

- The frontend uses React Router hash routes: login, hub, live sites, preview, builder, global users, catalogue, tests, and settings.
- Site navigation and views are intended to be driven by published module configuration. Sites are addressed by **site ID** in business API paths; slugs are for frontend navigation.
- The 13 approved module keys are `auth_rbac`, `user_mgmt`, `inventory`, `dashboard_shell`, `request`, `approval`, `material_assignment`, `assignment_frontend`, `consumption`, `returns`, `pcb_repair`, `analytics`, and `reports_excel`. The registry in `frontend/src/lib/registry.js` defines module configuration, typed connections, presets, and configurable fields. Validate submitted configuration on the server; do not rely on frontend validation.
- Configurable fields include text, number, select, date, item-reference, and calculated fields. Enforce required fields and valid choices, parse numeric values, recalculate derived values on the server, and verify item references belong to the same site.
- Authentication uses a server-issued JWT in the HttpOnly `token` cookie. The frontend sends credentials and does not read or persist the token in browser storage. Protected API requests must be authorized from that cookie on the backend; never trust frontend role state for authorization.

## Compatibility API

Unless the frontend is updated in the same change, preserve these paths and payload conventions when replacing `frontend/src/lib/api.js`. `:siteId` is a site UUID, not a slug.

| Area | Method and path | Expected behavior |
| --- | --- | --- |
| Authentication | `POST /api/auth/login` | All account types use this endpoint. Accept `{email,password}`, set the HttpOnly auth cookie, and return public user/site data without the token; invalid credentials return 401. |
| Global-admin signup | `POST /api/auth/global-admin/signup` | Accept `{name,email,password}` and create an active global administrator; password must be at least 12 characters. Returns public user data without a password hash. |
| Current user | `GET /api/auth/me` | Return the authenticated public user, without password hashes. |
| Logout | `POST /api/auth/logout` | Clear the HttpOnly auth cookie. |
| Sites | `GET /api/sites` | Return accessible site summaries with `id`, `slug`, `name`, `description`, `live`, `role`, `theme`, and `moduleTypes`. |
| Site detail | `GET /api/sites/:siteId` | Return `{site,role,config}`; Admin may also receive `draft`, `versions`, and `deploys`. |
| Site creation | `POST /api/sites` | Admin; accept `{name,slug,preset,description?}` and return `{id,slug}`. |
| Builder draft | `PUT /api/sites/:siteId/draft` | Site Admin; accept `{draft:{nodes,edges,theme}}`, including incomplete drafts while editing; return `{saved:true}`. |
| Publish / rollback | `POST /api/sites/:siteId/publish`; `POST /api/sites/:siteId/rollback` | Site Admin; publishing validates the complete configuration and accepts `{note}`; rollback accepts `{version}`; return the resulting `{version}`. |
| Inventory | `GET|POST /api/:siteId/inventory`; `PUT|DELETE /api/:siteId/inventory/:id` | Site-scoped inventory CRUD. Create/update accept configured fields; delete returns `{deleted:id}`. |
| Requests | `GET|POST /api/:siteId/requests` | Site-scoped list/create. Creation returns a row including generated `id`, `site_id`, `createdAt`, `requestNo`, `status`, `step`, and `requestedBy`. |
| Approvals | `GET|POST /api/:siteId/approvals` | Create accepts `{requestId,decision,comment}` where decision is `approve` or `reject`; update request workflow state atomically. |
| Assignments | `GET|POST /api/:siteId/assignments` | Create accepts `{requestId,qty,assignee}`; require an approved request and atomically decrement stock and create the assignment. |
| Consumption | `GET|POST /api/:siteId/consumption` | Create accepts `{assignmentId,qty,note,date?}` and reduces the assignment's remaining quantity. |
| Returns | `GET|POST /api/:siteId/returns` | Assignment return: `{source:"assignment",refId,qty,condition,reason}`; repair return: `{source:"repair",refId,resolution,reason}`. Good returns restock stock; damaged returns do not. |
| Repairs | `GET|POST /api/:siteId/repairs`; `PUT|DELETE /api/:siteId/repairs/:id` | Create/update configured repair fields; support the repair lifecycle `diagnosis → repairing → testing → completed`. |
| Members | `GET|POST /api/:siteId/members`; `PATCH|DELETE /api/:siteId/members/:userId` | Site Admin manages memberships with `{name,email,role}` for adds and `{role}` for updates. New accounts use the email prefix before `@` as their initial password; existing users may be added by email without changing their password. Delete removes only that site's membership. Responses expose public user data and site `role`. |
| Global users | `GET|POST /api/users`; `PATCH|DELETE /api/users/:id` | Global Admin only. Create accepts `{name,email,role,memberships?}` (`User` or `Admin`) and uses the email prefix before `@` as the initial password; patch supports `name`, `email`, `role`, `memberships`, and `password`. Never return password hashes. |
| Reports | `GET /api/:siteId/export/:resource` | Return `{columns,rows,filename,role}` for client-side spreadsheet generation. |
| Inventory import | `POST /api/:siteId/import/inventory` | Manager+; accept `{rows:[...]}`, upsert by SKU, return `{created,updated}`. Reject the entire import if any row is invalid. |

The UI also attempts inventory, request, and repair reads on the hub for summary counts. It catches per-resource errors and can show placeholders, so do not make an individual summary resource failure break site listing.

## Authorization and tenant isolation

The simulator's role checks are the expected minimum authorization behavior; enforce them in API middleware/service logic, not only in the UI.

| Operation | Minimum site role |
| --- | --- |
| Read inventory, requests, approvals, assignments, consumption, returns, repairs; export reports | Member |
| Create requests, consumption, returns; read members | Member |
| Create/update inventory, update requests, create approvals/assignments, create/update repairs; import inventory | Manager |
| Delete inventory, requests, repairs | Admin |
| Manage members, builder/draft/preview/publish/rollback, global user administration | Admin |

Global Admin bypasses site membership in the prototype. Other users need a membership with `Member`, `Manager`, or `Admin`. Approvals, assignments, consumption, and returns are immutable in the simulator after creation. The frontend catalogue has at least one permission discrepancy (inventory creation); prefer the checks in `frontend/src/lib/api.js` and preserve the stricter rule above unless product requirements explicitly change.

Scope every business read and write to the authenticated user's site membership and requested `siteId`. Validate referenced records against that same site. Return 404 for missing, disabled, or cross-site records rather than disclosing another tenant's data. Enforce isolation in PostgreSQL as well as in application code: use site-scoped foreign keys and row-level security for every business table. Keep workflow changes transactional; in particular, assignment creation, stock decrement, and request state changes must succeed or roll back together and must be safe under concurrent requests.

## Errors and data contracts

- Keep response shapes compatible with the simulator. Business rows commonly expose `id`, `site_id`, and `createdAt`; workflow rows include generated fields such as `requestNo`, `status`, `step`, `requestedBy`, `remaining`, and audit actor/time fields. Check the concrete handler before relying on a shape.
- Use structured JSON errors with `status`, `message`, and optional `details`. Maintain meaningful HTTP statuses: 401 unauthenticated, 403 forbidden, 404 missing/disabled/cross-site, 409 conflict, and 422 invalid input.
- Validate all user input and configuration server-side. Never trust client-provided user IDs, site roles, calculated values, totals, stock levels, or workflow states.
- Do not implement the settings page's JSON backup/restore as a server endpoint without an explicit product decision; it currently exports/restores the entire browser-local database. Likewise, spreadsheet parsing/generation is currently client-side; the described backend endpoints exchange JSON rows.

## Backend implementation conventions

- Backend code is JavaScript ES modules. Keep HTTP routes/controllers/services organized under `src/modules/`; shared auth and utilities belong in `src/middleware/` and `src/lib/`.
- Use the existing PostgreSQL pool and Drizzle schema in `src/db/`. Add schema changes through Drizzle migrations; apply migrations before running `npm run db:seed`.
- Hash passwords with the existing password helper; sign and verify JWTs with the existing JWT helper. Require `JWT_SECRET` in the environment and do not use frontend/demo secrets.
- Keep async route failures visible through centralized Express error handling. Do not silently convert database/auth errors into successful or empty results.
- Backend scripts are in `package.json`: `npm run dev`, `npm run db:generate`, `npm run db:migrate`, `npm run db:push`, and `npm run db:seed`. The current `npm test` is only a placeholder; do not claim backend tests pass until real tests exist.

## Known frontend incompatibilities and gaps

- The frontend HTTP client and base-URL setting use credentialed cookie requests. TanStack Query connects requests, approvals, assignments, consumption, and analytics for UUID-backed sites; remaining business operations still need to replace/adapt the local simulator.
- The unused `frontend/src/views/Distribution.jsx` submits assignments with `{itemId,qty,assignee}`, while the simulator expects `{requestId,qty,assignee}`; the live site route also does not currently register that view. Do not treat it as the supported assignment contract without reconciling the frontend.
- Browser-local backup, demo credentials, client-side auth, and frontend isolation tests do not provide production persistence, security, or database tenant isolation.
- `frontend/docs/schema.sql` is an incomplete draft. The Drizzle schema and migrations must be completed and tested against all required resources and isolation constraints.
