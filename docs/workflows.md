# Operational workflows

Workflow stages are implemented in backend services and should be checked there when changing behavior. This guide describes the intended service flow and persistent record relationships.

## Request and approval

1. A site member creates a request with configured form values and, where applicable, request line items.
2. The request service checks site membership and configuration. Requests without an approval module can enter an open state; configurations with approval steps use pending review.
3. An authorized reviewer submits a decision through the approval endpoint. Approval history is recorded and the request advances through configured steps or is rejected.
4. Approved requests can be fulfilled through assignments; repair workflows can also originate from an approved request.

## Assignment and stock

Assignments issue requested inventory to a person/team. Assignment creation validates request and item availability, locks relevant stock rows, decrements on-hand quantities, records stock movements, changes request state, and creates assignment records inside a transaction. If any step fails, the transaction rolls back. Do not manually decrement inventory separately when using this workflow.

## Consumption

Consumption entries refer to assignment items. Recording use updates the consumed/remaining quantity and creates a consumption record. Validate that consumption does not exceed the quantity assigned or remaining.

## Returns

The return module handles material returned from assignments and repaired devices, depending on configured connections. Material returns are associated with the source assignment/item and can affect available stock according to the service logic. Do not treat a return as a generic inventory edit; use the return workflow so its relationship/history is preserved.

## Repairs

Repair records track device/board, fault, diagnosis, costs, and lifecycle stage. The stages are `diagnosis` â†’ `repairing` â†’ `testing` â†’ `completed`. Repair parts are associated with the repair record. Return workflows may record a completed/repaired device handoff.

## Configuration publishing

Site draft configuration is JSON containing module nodes/edges, typed connections, and presentation settings. Draft save validates and stores the draft; publish validates it and creates a versioned release. Rollback selects a previous version and creates a new published state according to the site service. The frontend registry validates module compatibility and is the reference for the 13 approved module types.

## Operational boundaries

- All backend operational requests require an authenticated user with site membership. Specific minimum roles vary by action.
- The frontend has no local operational data simulator. Backend transaction and tenant isolation tests remain pending.
- RLS is not enabled. Current site isolation relies on API/service checks and same-site relational constraints.
