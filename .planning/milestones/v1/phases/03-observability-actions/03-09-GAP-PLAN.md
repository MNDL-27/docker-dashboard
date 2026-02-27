---
phase: 03-observability-actions
plan: 09
type: execute
wave: 8
depends_on: ["03-05", "03-06", "03-07"]
gap_closure: true
files_modified:
  - apps/api/src/websocket/server.ts
  - apps/web/src/app/(dashboard)/fleet/[hostId]/[containerId]/page.tsx
autonomous: true
requirements:
  - METR-04
  - LOGS-04
  - ACTN-05

must_haves:
  truths:
    - User can view live metrics stream updating every 1-5 seconds
    - User can view live log tail from any container
    - Protected containers policy blocks stop unless user has Admin role
  artifacts:
    - path: apps/api/src/websocket/server.ts
      provides: WebSocket broadcast of telemetry to UI
    - path: apps/web/src/app/(dashboard)/fleet/[hostId]/[containerId]/page.tsx
      provides: Dynamic RBAC integration
---

# Plan 03-09: Gap Closure - Observability Telemetry & RBAC Wiring

<objective>
Fix the two critical gaps identified during Phase 3 Verification:
1. The WebSocket server ingests metrics/logs from the agent but fails to relay them to connected web UI clients.
2. The ActionMenu in the Web UI uses hardcoded dummy values (`isProtected={false}`, `userRole="ADMIN"`) instead of dynamically resolving them.
</objective>

<execution_context>
@C:/Users/proti/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/03-observability-actions/03-VERIFICATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Broadcast Telemetry to Web Clients</name>
  <files>apps/api/src/websocket/server.ts</files>
  <action>
Implement the missing WebSocket relay logic:
- Inside the agent `ws.on('message')` handler, where `saveMetricsBatch` and `saveLogsBatch` are called, add logic to iterate over all active `webClients`.
- Forward the exact JSON payload `('metrics' or 'logs')` to each web client whose `ws.readyState === WebSocket.OPEN`.
- Ensure this runs asynchronously or unblocks the main thread so agent ingestion remains fast.
  </action>
  <verify>tsc --noEmit</verify>
  <done>API successfully relays agent payloads to Web UI sockets</done>
</task>

<task type="auto">
  <name>Task 2: Wire UI Action RBAC and Protection Logic</name>
  <files>apps/web/src/app/(dashboard)/fleet/[hostId]/[containerId]/page.tsx</files>
  <action>
Replace hardcoded RBAC with derived state:
- Compute `isProtected` dynamically. Check if `container.labels?.['com.docker.dashboard.protected'] === 'true'`.
- Retrieve the user's role from the Next.js auth endpoint (e.g. `/api/me`) or use a global user context if available. For MVP gap closure, if global context isn't quickly accessible, default the role safely to `OPERATOR` or fetch it via `apiFetch('/api/me')` on mount.
- Pass the real `isProtected` and `userRole` properties down to the `<ActionMenu />`.
  </action>
  <verify>npm run build</verify>
  <done>Action Menu protections enforce real values instead of static mocks</done>
</task>

</tasks>

<verification>
Ensure both API and Web projects compile successfully (`npx tsc --noEmit` and `npm run build`).
</verification>

<success_criteria>
- Metrics and Logs flow entirely end-to-end from Agent -> Cloud API -> Web Dashboard.
- Stopping a "protected" container natively blocks operators dynamically.
</success_criteria>

<output>
After completion, create .planning/phases/03-observability-actions/03-09-SUMMARY.md
</output>
