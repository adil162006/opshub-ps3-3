# OpsHub: five-minute judge demo

## Goal

Demonstrate that one application can support distinct operations sites through saved module configuration, and that each site's operational views use backend data.

Use the [judge demo runbook](demo-runbook.md) to prepare the environment. Sign in before starting the timer. Use a global administrator account configured specifically for the demo; never put credentials, tokens, or database secrets in the presentation or this guide.

## Five-minute walkthrough

### 0:00–0:25 — Introduce the idea

**Show:** The OpsHub hub after signing in.

**Say:**

> “OpsHub is one operations hub for multiple sites. Instead of building a separate application for every team, we configure each site with the modules and workflows it needs, then serve its operational data through the backend.”

### 0:25–1:00 — Show distinct sites

**Show:** The site cards and their module tags. Point out Central Stores, Service Centre, and Distribution Team if all three are present.

**Say:**

> “These are different operating contexts on the same application: inventory, repair service, and field distribution. Their navigation and pages come from each site's saved configuration, rather than a feature set hard-coded to its URL.”

**Transition:** Open **Central Stores**.

### 1:00–1:50 — Inventory and insight

**Show:** **Inventory**, then **Analytics** if time allows.

**Say:**

> “Inventory is scoped to the selected site. Reorder thresholds make stock exceptions visible, and analytics uses the data associated with the modules enabled for this site.”

Point to an actual below-reorder item if one is present. In the included sample seed, `IC-TI-DRV` has 9 on hand against a reorder level of 10. Do not edit stock.

**Transition:** Use the site switcher to open **Service Centre**.

### 1:50–2:35 — Repair service

**Show:** **Repairs**. Point to the different repair stages and a repair record.

**Say:**

> “The service site uses the same platform for a different workflow. Repair records track device, fault, diagnosis, costs, and progress; request and return records connect the repair process to the rest of the operation.”

The sample seed includes repair requests `SR-REQ-1001`, `SR-REQ-1002`, and `SR-REQ-1003`. The UI may show these request numbers rather than the internal repair ticket numbers. Do not change a stage.

**Transition:** Use the site switcher to open **Distribution Team**.

### 2:35–3:25 — Distribution and traceability

**Show:** **Field View**, then **Consumption Tracking**.

**Say:**

> “Distribution connects approved requests to issued material and tracks what is still in the field. The assignment, remaining quantity, and consumption history are linked records—not a manually edited stock figure.”

In the sample seed, request `FD-REQ-5001` is linked to an assignment with 12 capacitors issued, 7 consumed, and 5 remaining. Point to values actually visible in the UI. Do not click **Mark consumed** or submit a form.

### 3:25–4:25 — Show configuration

**Transition:** Return to the hub and open the Builder for a site.

**Show:** The module canvas, typed connections, validation state, and optionally the **Releases** tab. Selecting a node to inspect its configuration is fine; do not drag, add, remove, edit, preview, publish, or roll back.

**Say:**

> “The builder uses a registry of 13 approved module types. Connections are typed and validated—for example, Approval depends on Request—and the site's published configuration determines which pages render. Draft preview, versioned publishing, release history, and rollback are supported. I'm keeping the live demo read-only.”

If the displayed draft is invalid, do not call it publish-ready. Return to the hub or show the published site.

### 4:25–5:00 — Close with the boundary

**Show:** The hub or the most relevant site.

**Say:**

> “The core idea is configuration-driven operations across sites, backed by shared services and site-scoped records. This is a working prototype, not a production-hardened multi-tenant deployment: PostgreSQL row-level security, backend integration tests, and a deployed end-to-end environment are still outstanding. Those are explicit next steps, not capabilities I'm claiming today.”

Stop at five minutes and invite questions.

## Likely judge questions

| Question | Accurate short answer |
|---|---|
| Does operational data come from the browser or backend? | Site configuration and operational records are fetched from the Express API and PostgreSQL. The frontend has no browser-local operational database. |
| How does each site get different pages? | Its enabled modules, typed connections, and presentation configuration drive navigation and rendered views. |
| How are operations protected? | The API checks authentication, site membership, and operation-specific roles; services scope queries by site. |
| Is tenant isolation production-complete? | No. RLS is not installed, and API/database cross-site integration tests remain outstanding. |
| Is it production-ready? | Not yet. RLS, backend integration coverage, and a deployed end-to-end environment are outstanding. |
| Can site configuration be rolled back? | Yes. The builder supports versioned publish and rollback. This presentation does not alter live configuration. |

## Timing fallback

If time is short, skip Analytics or the release-history tab. Preserve the hub → two or three site-specific workflows → honest close. If sample records are missing, skip them rather than improvising data.
