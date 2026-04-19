---
status: investigating
trigger: "Investigate production 502s on https://app.dockerdash.app/app/containers. Symptoms: visiting containers page shows repeated 502s for GET /api/admin/* endpoints (overview, users, hosts, organizations, operations, audit-log, billing/*) and POST /api/docker-proxy actions all-containers/all-container-stats/listContainers/hostMetrics. Determine why admin queries are firing from containers navigation and identify most likely server-side cause of the admin endpoint 502s from code. Return concise root cause findings with file references; do not make changes."
created: 2026-04-19T00:00:00+05:30
updated: 2026-04-19T00:16:00+05:30
---

## Current Focus

hypothesis: The `/api/admin/*` burst is not initiated by `ContainersPage`; it matches `AdminPage` mounting all admin hooks at once. The most likely backend failure is schema bootstrap code in `ensureAdminSchema()` throwing before admin handlers can return normal JSON, with the same bootstrap path also reached from `requireAuth()` in docker-proxy.
test: Confirm route-level hook usage and compare it with the exact admin endpoint set; then trace shared admin schema/auth dependencies that are executed before admin and docker-proxy request handling.
expecting: The containers route should only issue docker/metrics calls, while the admin endpoint list should map 1:1 to `AdminPage` hooks. A fragile shared runtime schema dependency should explain widespread admin 502s.
next_action: finalize diagnosis with exact file references and root-cause summary

## Symptoms

expected: Navigating to `/app/containers` should only load containers-related data and should not trigger unrelated admin endpoints.
actual: Visiting `/app/containers` triggers repeated 502s for GET `/api/admin/*` endpoints and POST `/api/docker-proxy` actions `all-containers`, `all-container-stats`, `listContainers`, and `hostMetrics`.
errors: HTTP 502 responses from GET `/api/admin/overview`, `/users`, `/hosts`, `/organizations`, `/operations`, `/audit-log`, `/billing/*`; HTTP 502 responses from POST `/api/docker-proxy` for `all-containers`, `all-container-stats`, `listContainers`, `hostMetrics`.
reproduction: Open `https://app.dockerdash.app/app/containers` in production and observe network requests/errors.
started: unknown

## Eliminated

## Evidence

- timestamp: 2026-04-19T00:04:00+05:30
  checked: codebase search for `/app/containers`, `/api/admin/*`, and `/api/docker-proxy` action strings
  found: `src/pages/app/ContainersPage.tsx` is the route component for `/app/containers`; admin routes are consolidated through `netlify/functions/api-admin-splat.mts`; docker-proxy actions `all-containers` and `all-container-stats` are implemented in `netlify/functions/api-docker-proxy.mts`; there is an existing prior debug record for docker-proxy host-metrics 502 behavior.
  implication: The investigation should split into client-side route/layout request sources and shared server-side admin function behavior.

- timestamp: 2026-04-19T00:09:00+05:30
  checked: `src/App.tsx`, `src/pages/app/ContainersPage.tsx`, `src/components/layout/AppShell.tsx`, `src/components/layout/AppSidebar.tsx`, `src/hooks/useViewerState.ts`
  found: `/app/containers` and `/app/admin` are separate route elements; `ContainersPage` mounts only `useDockerHosts`, `useContainers`, `useAllContainerStats`, and `useFleetMetrics`; shared shell/sidebar code only calls `useViewerState` (`/auth/me`) and does not import admin hooks.
  implication: Navigating to `/app/containers` does not directly explain `/api/admin/*` requests from code; those requests must come from an `AdminPage` mount elsewhere in the SPA/session.

- timestamp: 2026-04-19T00:12:00+05:30
  checked: `src/hooks/useAdmin.ts`, `src/pages/app/AdminPage.tsx`
  found: `AdminPage` unconditionally mounts `useAdminOverview`, `useAdminUsers`, `useAdminOrganizations`, `useAdminHosts`, `useAdminAuditLog`, `useAdminOperations`, `useAdminUnmatchedBillingEvents`, and `useAdminDonorEmailDeliveries` on render, and the app uses a default `new QueryClient()` with no retry overrides.
  implication: The exact endpoint burst seen in production is the signature of `AdminPage` rendering; repeated failures are amplified by default React Query retries.

- timestamp: 2026-04-19T00:15:00+05:30
  checked: `netlify/functions/lib/admin-handler.mts`, `netlify/functions/lib/auth.mts`, `netlify/functions/lib/ensure-admin-schema.mts`, `netlify/functions/api-docker-proxy.mts`, `netlify/functions/lib/db.mts`, `netlify/schema.sql`
  found: Every admin request enters `handleAdminRequest()` and immediately calls `ensureAdminSchema()`. `requireAuth()` also calls `ensureAdminSchema()` before resolving the user, so docker-proxy requests hit the same bootstrap path. `ensureAdminSchema()` performs a long sequence of request-time DDL (`ALTER TABLE`, `CREATE TABLE`, `DROP TRIGGER`, `CREATE TRIGGER`) guarded only by an in-memory `schemaEnsured` boolean, so concurrent serverless invocations can all run the full migration sequence independently. The same file also assumes `uuid_generate_v4()` and `update_updated_at_column()` already exist, but those are only defined in `netlify/schema.sql`, not the runtime ensure path.
  implication: The most plausible code-level cause of widespread admin 502s is hot-path schema migration fan-out in `ensureAdminSchema()` causing lock/latency failures under parallel requests, with missing bootstrap objects as an additional schema-drift risk. Because docker-proxy also enters `ensureAdminSchema()` via `requireAuth()`, the same issue can affect both admin and docker-proxy traffic.

## Resolution

root_cause: `/app/containers` does not itself fire `/api/admin/*` calls. The observed admin request fan-out matches `AdminPage` mounting its top-level admin queries. The most likely server-side cause of the 502s is request-time schema migration in `ensureAdminSchema()`: admin handlers call it directly, and docker-proxy reaches it through `requireAuth()`. Since `ensureAdminSchema()` runs many DDL statements and is guarded only by a process-local boolean, parallel serverless invocations can stampede the database and trigger lock/timeout/gateway failures. The code is additionally brittle because it assumes `uuid_generate_v4()` and `update_updated_at_column()` already exist from `netlify/schema.sql`.
fix:
verification: Diagnosis only; verified by static tracing of client request sources and shared backend dependency paths.
files_changed: []
