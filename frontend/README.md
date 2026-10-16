# OpsHub — one codebase, many operations sites

Config-driven multi-site prototype: Hub → Builder → API → data. React + Vite + Tailwind + React Router + Zustand + React Flow + Recharts + SheetJS.

```bash
npm install
npm run dev              # http://localhost:5173
npm run test:isolation   # 50 site_id / RBAC / transaction tests (also in-app: Tests page)
npm run build
```

The API layer (`src/lib/api.js`) is a simulated REST backend running in the browser (localStorage) with the contract `/api/:siteId/:resource`: JWT, bcrypt, RBAC (Public/Member/Manager/Admin), `site_id` forced on every write, cross-site IDs return 404, transactional stock updates (clone → mutate → commit, rolled back on error). `docs/schema.sql` is the PostgreSQL target (site_id + RLS + same-site composite FKs).

## Demo accounts
| Email | Password | Access |
|---|---|---|
| admin@opshub.io | admin123 | Admin everywhere |
| manager@opshub.io | manager123 | Manager, all 3 sites |
| member@opshub.io | member123 | Member, all 3 sites |
| stores@opshub.io | stores123 | Manager, Central Stores only |
| tech@opshub.io | tech123 | Manager, Service Centre only |

## Demo script
1. Sign in as admin → Hub lists Central Stores, Service Centre, Distribution; use the switcher.
2. Open Service Centre (top-bar, purple, request → approval → repair board) then Central Stores (sidebar, blue, inventory + analytics + Excel).
3. Builder → Distribution → drag **Return Management**, connect Assignment → Returns → Releases → Publish → open live: Returns page exists, no code change. Roll back from the Releases tab.
4. Central Stores → Inventory: Export .xlsx; sign in as member to see import disabled.
5. Distribution → Assignments: tick “simulate crash” → stock unchanged (transaction rollback).
6. Tests page → Run all. Backup page → download/restore/reset (offline fallback).

## Layout
`src/lib/registry.js` 13 modules as typed nodes, presets, validation · `api.js` backend · `seed.js` demo data · `isolation.js` tests · `src/views/*` module renderers · `src/pages/*` hub, builder, catalogue.
