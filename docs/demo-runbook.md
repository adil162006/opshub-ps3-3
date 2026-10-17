# Judge demo runbook

This is the preparation and recovery checklist for the [five-minute judge demo](judge-demo.md). Complete the setup before the audience arrives.

## 1. Prepare a demo environment

Use a dedicated local/demo PostgreSQL database. Do not seed a database containing records that must be preserved. The full seed command upserts example data and updates the configured seeded administrator's profile/password.

From the repository root, prepare the backend in one terminal:

```powershell
Set-Location backend
npm install
Copy-Item .env.example .env
```

Set these values in `backend/.env`:

- `DATABASE_URL` — the dedicated demo database.
- `JWT_SECRET` — a unique, cryptographically random secret of at least 32 bytes.
- `CORS_ORIGINS` — include the exact browser origin, normally `http://localhost:5173`.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` — both are required by the current full seed command. Use private demo credentials; no sample password is supplied by the repository.
- `SEED_ADMIN_NAME` — optional presenter display name.

Invitation email is not needed for the walkthrough. Only configure SMTP if intentionally demonstrating email-dependent invitations.

## 2. Migrate and seed before the event

From `backend/`:

```powershell
npm run db:migrate
npm run db:seed
```

`db:seed` itself runs database preparation/migrations and both base and operational seed scripts. Seeding may update the existing configured admin account and deterministic demo records. Do not run it during the timed presentation.

The sample seed creates three sites—Central Stores, Service Centre, and Distribution Team—plus operational examples. Seed values are optional and may differ if the database has been modified.

## 3. Start services

Keep the API running in the backend terminal:

```powershell
npm run dev
```

In a second terminal from the repository root, start Vite:

```powershell
npm install --prefix frontend
npm --prefix frontend run dev
```

Open `http://localhost:5173`. If using a different frontend origin, update `CORS_ORIGINS` and restart the API. If the API is not at `http://localhost:3000`, configure `VITE_BACKEND_URL` for the frontend build/dev environment.

## 4. Preflight checklist

- [ ] `http://localhost:3000/health` responds successfully.
- [ ] `http://localhost:3000/ready` reports database readiness.
- [ ] The frontend loads without API or CORS errors.
- [ ] Sign in with the configured presenter global-admin account.
- [ ] The hub lists the intended site cards and their module tags.
- [ ] Open each site once; verify its pages and sample data before presenting.
- [ ] Central Stores has a visible below-reorder item, if using the inventory segment.
- [ ] Service Centre has repair records visible in the Repairs page.
- [ ] Distribution has a visible assignment/consumption example.
- [ ] The selected builder site loads and its canvas is readable; do not assume its draft is valid until checked.
- [ ] Browser zoom, window size, and navigation are presentation-ready.
- [ ] Keep credentials out of the browser address bar, terminal projection, screenshots, and docs.

Sample seed checkpoints, if present:

| Site | Checkpoint |
|---|---|
| Central Stores | `IC-TI-DRV`: 9 on hand, reorder at 10. |
| Service Centre | Repair requests `SR-REQ-1001` to `SR-REQ-1003`. The repair view may show the linked request number rather than the repair ticket. |
| Distribution Team | `FD-REQ-5001`: 12 capacitors issued, 7 consumed, 5 remaining. |

Verify the live records; these checkpoints are examples, not guarantees.

## 5. Presentation safety

Use the timed script as a read-only walkthrough. Do not submit requests, approve work, assign or consume stock, record returns, alter a builder configuration, publish, or roll back during the demo. Avoid leaving the app on a form that could be submitted accidentally.

## 6. Recovery

- **Login failure:** Confirm the configured demo email/password and backend logs. A new seed run changes the configured seeded administrator password to the current environment value; only reseed outside the presentation and on the demo database.
- **Sites or operations do not load:** Check browser/API connectivity and CORS, then `/health` and `/ready`. Do not claim a page with an error or stale data is live.
- **Missing sample record:** Skip that example. Do not manually create data during the demo.
- **Invalid builder draft:** Do not publish it. Return to the hub and show the published site configuration.
- **Time pressure:** Skip Analytics or release history; keep the cross-site story and the prototype limitations in the close.

## Important limitations

The repository has no deployed judge environment, PostgreSQL RLS policies, or backend integration test suite. The backend `npm test` script is a placeholder. The presenter should describe these limitations directly; do not imply the local demo verifies production isolation or availability.
