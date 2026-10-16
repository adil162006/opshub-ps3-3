# OpsHub Project Guide

OpsHub is a configuration-driven multi-site operations hub. Its goal is to let one application run distinct operations sites from shared modules, with site-specific themes, pages, fields, workflows, and roles. See [features.md](features.md) for the current implementation status and remaining requirements.

## Architecture

- `frontend/` is a React + Vite application. Shared UI, demo seed data, module definitions, and the current simulated API live under `frontend/src/`.
- `frontend/src/lib/registry.js` is the source of truth for the approved 13 module types, their typed inputs/outputs, presets, and configuration validation.
- `frontend/src/pages/` contains the hub, builder, login, and administration screens; `frontend/src/views/` contains site module views.
- `backend/` is intended for the Express + PostgreSQL + Drizzle service. It is currently scaffolding, not a working API. Do not treat the frontend's browser-local simulated API or isolation tests as backend/database enforcement.
- `frontend/docs/schema.sql` is an incomplete schema draft, not a complete production migration.

## Working conventions

- Keep the scope to the 13 approved modules unless the product requirements are explicitly changed.
- Keep site configuration-driven behavior consistent across the builder, published renderer, and API. Avoid slug-specific module behavior; enabled modules and their typed connections should determine available features.
- Scope every business-data read and write to its site. Enforce role checks on the server, and design the PostgreSQL schema so tenant isolation is enforced in the database as well as the API.
- Treat browser-based demo credentials, JWT handling, bcrypt hashes, persistence, and transaction logic as prototype-only until replaced or backed by the server.
- Preserve the existing React/JSX and ES-module patterns. Keep frontend and backend commands scoped to their respective directories.

## Build and test

Run from the repository root:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run test:isolation
```

Backend development and Drizzle scripts are defined in `backend/package.json`, but the backend test script is currently a placeholder and the server is not implemented. Do not report a backend test run as passing until real backend tests exist.
