# Operational workflows

This guide describes the implemented service behavior at a high level. Exact validation and authorization rules live in `backend/src/modules/*/*.service.js`; frontend forms are not the security boundary.

## Requests and approvals

1. An authenticated site member submits fields configured on that site's Request module. If an item field is configured, the service resolves the selected item within the same site and may persist a normalized request line.
2. When the site has an Approval module with configured steps, new requests start `pending`; otherwise they start `open`.
3. A reviewer submits `approve` or `reject` for the request's current step. The service checks the configured role, locks the request row, records the decision, and advances to the next step. Completing all steps marks the request `approved`; rejection marks it `rejected`.
4. Request editing is restricted to eligible pending requests or open requests without an approval chain. Deletion is more restricted.

## Assignment and stock

An authorized Manager can assign an approved/open request when the site configuration has the required Assignment and Request modules. The service checks the request's requested item and quantity, locks the relevant request and inventory rows, verifies available stock, decrements the balance, writes a stock movement, creates assignment and assignment-item rows, and updates request state in a database transaction. A failed step rolls the transaction back.

Do not manually decrement stock as part of this workflow. Stock-on-hand and movement history must remain consistent.

## Consumption

A site member records usage against an assignment item. The service locks the assignment item, checks that the quantity does not exceed the remaining quantity, updates the remainder, and inserts a consumption record in one transaction. Assignment status moves to `in-use` while quantities remain and `completed` when all associated items are exhausted.

## Returns

Return Management supports material returns from assignments and repair/device returns when the corresponding modules are connected. A material return references its source assignment item; service logic validates quantity and condition and applies any restock/movement behavior. A repair return references the repair record. Preserve these links and history by using the Returns workflow instead of changing inventory directly.

## Repairs

Starting a repair requires an eligible approved/open request and Manager authorization. The service creates a repair record in `diagnosis`, records technician/device/fault data, and moves the request to `in-repair`. Repair stages are `diagnosis` → `repairing` → `testing` → `completed`; the service validates stage updates and closes the linked request when marked completed. Repair costs and repair parts are retained with the record.

## Inventory and reporting

Inventory balances are site-specific. Manual stock movements and import paths are role-restricted; assignment and return services manage their own movements as part of those business transactions. Excel exports and inventory imports are also role-restricted and may create job/audit records. See the [API reference](api.md) and the relevant inventory/report service for payload details.

## Configuration publishing

The builder edits a site's JSON draft of module nodes/typed edges and presentation settings. Saving a draft validates it. Preview is administrator-only; publish validates the draft, creates a version and deployment record, and updates the live configuration. Rollback selects a prior version and creates a rollback deployment rather than erasing release history.

The approved 13 module types and client-side semantics live in `frontend/src/lib/registry.js`. Keep the backend configuration validator and the site service aligned with that registry.

## Authorization and operational boundaries

- Site operations require authentication and site membership, except that a global administrator has site Admin access.
- The minimum role varies by service operation. The API and service, not the UI, enforce it.
- Database queries are site-scoped in services and selected relationships have same-site foreign keys.
- PostgreSQL RLS is not installed. Database-enforced tenant isolation and cross-site integration tests are outstanding.
- The frontend has no local operational simulator; optional seed data is stored in PostgreSQL.
