# HTTP API reference

This guide describes the Express routes mounted under `/api` in `backend/src/server.js`. The backend defaults to `http://localhost:3000`. All site identifiers in API paths are UUIDs unless a route explicitly accepts a slug; the frontend uses site UUIDs for operational calls.

## Conventions

- JSON endpoints accept and return JSON unless noted. Send `Content-Type: application/json` for JSON request bodies.
- Login sets the HttpOnly `token` cookie, scoped to `/api`. Browser clients must send credentials on API requests; the frontend Axios client is configured for this.
- Authenticated routes require that cookie. Site operations also check site access, enabled modules, and operation-specific roles in their services. A global administrator has site Admin access.
- Role checks differ by operation. Do not infer a complete permission matrix from this route list; check the relevant service before building another client.
- Health endpoints are outside `/api`.

## Health and readiness

| Method | Path | Authentication | Behavior |
|---|---|---|---|
| GET | `/health` | No | Process liveness. |
| GET | `/ready` | No | Queries PostgreSQL; returns readiness or forwards a database error. |

## Authentication

| Method | Path | Authentication | Behavior |
|---|---|---|---|
| POST | `/api/auth/login` | No | Accepts `{ "email": "...", "password": "..." }`; verified accounts receive an HttpOnly session cookie. Unverified accounts receive a short-lived phone-verification token in the `PHONE_NOT_VERIFIED` error details. |
| POST | `/api/auth/otp/send` | No | Accepts `{ "verificationToken": "...", "phoneNumber": "+..." }` and sends a code to the submitted number. |
| POST | `/api/auth/otp/verify` | No | Accepts `{ "verificationToken": "...", "phoneNumber": "+...", "otp": "..." }`; saves the verified number and returns an authenticated session. |
| POST | `/api/auth/global-admin/signup` | No | Creates the initial global administrator only when signup is permitted by the auth service. |
| POST | `/api/auth/logout` | No | Clears the authentication cookie; returns 204. |
| GET | `/api/auth/me` | Yes | Returns current authenticated user context. |

## Sites and configuration

All routes in this section require authentication. Create, delete, draft, publish, and rollback operations are global-administrator operations.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/sites` | Lists sites available to the current user and their role/module summary. |
| POST | `/api/sites` | Creates a site from an approved preset and publishes its initial configuration. |
| DELETE | `/api/sites/:siteId` | Deletes a site (global administrator only). |
| GET | `/api/sites/:siteId` | Returns the published configuration. `?preview=true` requests the draft and is global-administrator only. |
| PUT | `/api/sites/:siteId/draft` | Validates and saves a draft configuration. |
| POST | `/api/sites/:siteId/publish` | Validates and publishes the draft as a version; an optional note may be supplied. |
| POST | `/api/sites/:siteId/rollback` | Publishes a prior version selected by version number. |

Configurations contain module nodes and typed edges plus theme/presentation settings. The [frontend module registry](../frontend/src/lib/registry.js) defines the approved module vocabulary and client validation. The backend also validates site configuration.

## Global users and site members

| Method | Path | Authentication / role |
|---|---|---|
| GET, POST | `/api/users` | Global administrator. |
| PUT, PATCH, DELETE | `/api/users/:userId` | Global administrator. |
| GET | `/api/:siteId/members` | Authenticated member of the site; minimum role is enforced by the service. |
| POST | `/api/:siteId/members` | Global administrator. |
| PUT, PATCH, DELETE | `/api/:siteId/members/:userId` | Authenticated; role/site checks are performed by the service. |

New accounts are created with a name and email but no phone number. Users provide and verify their phone number during their first sign-in.

User invitation and related email operations require working SMTP configuration. See [setup and operations](setup.md).

## Site-scoped operational routes

All routes below require authentication, site access, and any module/role checks specified by the corresponding service. The route prefix is `/api/:siteId` unless a **Sites alias** column says `/api/sites/:siteId` is also registered.

| Resource | Methods and path | Sites alias | Notes |
|---|---|---|---|
| Inventory items | GET, POST `.../inventory`; GET, PUT, DELETE `.../inventory/:id` | Yes | List supports `?search=`. Create requires an SKU and name. |
| Inventory import/export | GET `.../inventory/export`; GET `.../inventory/template`; POST `.../inventory/import` | Yes | JSON import accepts rows; the inventory service checks role and validates rows. |
| Categories | GET, POST `.../categories`; PUT, DELETE `.../categories/:id` | Yes | Site-owned categories. |
| Stock movements | GET, POST `.../stock-movements` | Yes | List may filter by `?itemId=`. Movement types are `receipt`, `issue`, `adjustment`, `return`, `transfer_in`, and `transfer_out`. |
| Requests | GET, POST `.../requests`; PUT, DELETE `.../requests/:id` | No | Request fields are determined by the site's request module configuration. |
| Approvals | GET, POST `.../approvals` | Yes | POST submits a decision for the current configured step. |
| Assignments | GET, POST `.../assignments`; GET, PUT `.../assignments/:id` | Yes | Creation performs stock/request checks and writes the stock issue and assignment in a transaction. |
| Consumption | GET, POST `.../consumption` | No | Records consumption against an assignment item; optional list filtering is supported by the service. |
| Returns | GET, POST `.../returns` | Yes | Records a material or repair return according to enabled modules and request body. |
| Repairs | GET, POST `.../repairs`; PUT, DELETE `.../repairs/:id` | No | Repair lifecycle stages are validated by the service. |
| Analytics | GET `.../analytics` | Yes | Site-scoped summary data. |
| Excel report export | GET `/api/:siteId/export/:resource` | No | Returns an XLSX attachment for a supported resource; role restricted. |
| Inventory workbook import | POST `/api/:siteId/import/inventory` | No | Accepts XLSX raw body (up to 5 MB) or JSON rows, depending on content type; Manager role required. |

`...` above means the path prefix `/api/:siteId`; aliases are only registered for the resources marked **Yes**. Do not assume all resource routes support both prefix forms.

## Request and response behavior

- Successful collection reads commonly return arrays; create and update operations return JSON records or service-specific result objects.
- The controller/service is authoritative for each operation's exact payload and response shape. Configurable request and repair fields are validated against the site's published module configuration.
- Common status codes include 400 for malformed identifiers/requests, 401 for unauthenticated or inactive accounts, 403 for denied role/origin, 404 for inaccessible/missing resources, 409 for workflow/stock conflicts, and 422 for field validation. Exact error bodies may use `message` or `error`.
- Site operations are not guaranteed to have database-level RLS protection. API role checks and site-scoped queries do not replace database-enforced tenant isolation.

## Browser example

```js
const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

Use `credentials: 'include'` for subsequent authenticated requests as well. The configured backend CORS origin must exactly match the page origin and permit credentials.

## Implementation references

- Route registration: `backend/src/modules/*/*.routes.js`.
- Authentication cookie and controllers: `backend/src/modules/auth/`.
- Site configuration lifecycle: `backend/src/modules/sites/`.
- Workflow and role rules: each resource's `backend/src/modules/*/*.service.js`.
- Known platform gaps: [feature status](../features.md).
