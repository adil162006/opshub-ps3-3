# OpsHub HTTP API

Base URL defaults to `http://localhost:3000`. All API routes are under `/api`; health endpoints are not. JSON routes use `Content-Type: application/json`. Routes marked **auth** require a valid login cookie. Site routes require site membership and the relevant role. The API currently sets an HttpOnly cookie named `token`; the browser sends it with credentialed requests. There is no documented bearer-token requirement for the frontend.

## Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Process liveness |
| GET | `/ready` | No | PostgreSQL readiness check |

## Authentication

| Method | Path | Auth | Body / behavior |
|---|---|---|---|
| POST | `/api/auth/login` | No | `{ "email": "...", "password": "..." }`; sets HttpOnly cookie |
| POST | `/api/auth/global-admin/signup` | No | `{ "name": "...", "email": "...", "password": "..." }`; creates initial global admin where allowed |
| POST | `/api/auth/logout` | No | Clears cookie; returns 204 |
| GET | `/api/auth/me` | Yes | Current user and accessible-site context |

## Sites and configuration

| Method | Path | Auth | Body / query |
|---|---|---|---|
| GET | `/api/sites` | Yes | Sites available to current user |
| POST | `/api/sites` | Yes | JSON site configuration/metadata; creates site |
| GET | `/api/sites/:siteId` | Yes | Site and published configuration; `?preview=true` requests draft preview when authorized |
| PUT | `/api/sites/:siteId/draft` | Yes | `{ "draft": { ...configuration } }` |
| POST | `/api/sites/:siteId/publish` | Yes | Optional `{ "note": "..." }` |
| POST | `/api/sites/:siteId/rollback` | Yes | `{ "version": <version number> }` |

The configuration body is JSON and includes module nodes/edges and site presentation settings. The exact accepted shape is validated by the site service and frontend registry; see `frontend/src/lib/registry.js`.

## Users and memberships

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET, POST | `/api/users` | Yes | List/manage global users (global admin only) |
| PUT, PATCH, DELETE | `/api/users/:userId` | Yes | Update/delete global user (global admin only) |
| GET, POST | `/api/:siteId/members` | Yes | List/add a site's members |
| PUT, PATCH, DELETE | `/api/:siteId/members/:userId` | Yes | Update/remove a site membership |

User creation and invitation use the backend user-management flow. Configure SMTP before using invitation endpoints. Consult `backend/src/modules/users/users.service.js` for accepted fields and role-specific rules.

## Operational resources

The following route sets accept both `/:siteId/...` and `/sites/:siteId/...` forms where indicated. IDs are UUIDs.

| Resource | Methods and paths | Notes |
|---|---|---|
| Inventory | GET/POST `/api/:siteId/inventory`; GET/PUT/DELETE `/api/:siteId/inventory/:id` | `?search=` supported on list; create requires `sku`, `name` |
| Inventory import/export | GET `/api/:siteId/inventory/export`; GET `/api/:siteId/inventory/template`; POST `/api/:siteId/inventory/import` | JSON import body `{ "rows": [...] }`; import updates/inserts rows. Role restricted. |
| Categories | GET/POST `/api/:siteId/categories`; PUT/DELETE `/api/:siteId/categories/:id` | Create requires `name` |
| Stock movements | GET/POST `/api/:siteId/stock-movements` | List accepts `?itemId=`. Create requires `itemId`, `movementType`, `quantity`; supported types: `receipt`, `issue`, `adjustment`, `return`, `transfer_in`, `transfer_out`. |
| Requests | GET/POST `/api/:siteId/requests`; PUT/DELETE `/api/:siteId/requests/:id` | JSON form data and request items are interpreted by the request service. |
| Approvals | GET/POST `/api/:siteId/approvals` | POST submits a decision payload for the current approval step. |
| Assignments | GET/POST `/api/:siteId/assignments`; GET/PUT `/api/:siteId/assignments/:id` | Creation performs workflow/stock checks and a transaction. |
| Consumption | GET/POST `/api/:siteId/consumption` | Records consumption against issued assignment items. |
| Returns | GET/POST `/api/:siteId/returns` | Records returned material or repaired items. |
| Repairs | GET/POST `/api/:siteId/repairs`; PUT/DELETE `/api/:siteId/repairs/:id` | Repair stages are enforced by service workflow. |
| Analytics | GET `/api/:siteId/analytics` | Site-scoped aggregate data. |
| Excel reports | GET `/api/:siteId/export/:resource` | Returns XLSX attachment; supported resource names are validated by reports service. |
| Workbook import | POST `/api/:siteId/import/inventory` | Raw XLSX (`.xlsx`, up to 5 MB) or JSON `{ "rows": [...] }`; role restricted. |

Inventory, category, and movement routes also have `/api/sites/:siteId/...` aliases. The aliases are retained for frontend compatibility; new API clients should use one consistent form.

## Request and response conventions

- Successful collection reads return JSON arrays unless noted; create operations generally return 201 and the created record.
- Validation errors use 400 or 422; missing resources use 404; permission failures use 403; conflicts such as duplicate site SKU use 409.
- Some services return `{ "error": "..." }`; the centralized error handler also emits a JSON status/message shape. Clients should handle both `error` and `message` fields.
- Site business routes require a UUID site ID. Frontend site data is read from and written to these API endpoints.

## Browser example

```js
const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

For operational calls, also set `credentials: 'include'`. CORS must allow the exact frontend origin and credentials.

## Authorization note

The services check membership and role for site operations, but permission rules vary by operation. They are not fully represented by a single API-wide matrix. PostgreSQL RLS is not installed yet; API access controls are not a substitute for database-enforced tenant isolation. Consult the corresponding service for the authoritative rule before integrating a new client.
