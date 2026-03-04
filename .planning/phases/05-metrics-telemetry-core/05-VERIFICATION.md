---
phase: 05-metrics-telemetry-core
verified: 2026-03-04T17:56:53.144Z
status: human_needed
score: 11/11 must-haves verified
human_verification:
  - test: "Fleet telemetry stream renders live KPI changes"
    expected: "CPU/memory/network/restart KPI cards visibly update as new agent metric frames arrive for selected scope"
    why_human: "Requires running UI + active agents and validating real-time UX behavior"
  - test: "Pause/resume and speed presets affect live cadence"
    expected: "Pause stops KPI updates, resume restarts updates, and 1x/2x/4x alters perceived update frequency"
    why_human: "Needs end-to-end websocket timing observation in browser"
  - test: "History window switching updates trend context"
    expected: "Selecting 15m/1h/6h/24h updates KPI mini-trends without leaving fleet view"
    why_human: "Visual trend correctness and UX continuity cannot be fully proven by static analysis"
---

# Phase 5: Metrics Telemetry Core Verification Report

**Phase Goal:** Users can observe container health in real time with guaranteed short-history retention.
**Verified:** 2026-03-04T17:56:53.144Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Live metric samples are persisted against the correct scoped container records. | ✓ VERIFIED | `saveMetricsBatch` maps host-scoped Docker IDs to internal container UUIDs before `createMany` in `apps/api/src/services/metrics.ts:74`, `apps/api/src/services/metrics.ts:88`, `apps/api/src/services/metrics.ts:120`; regression test covers mapping in `apps/api/src/__tests__/metrics-ingest-retention.test.ts:69`. |
| 2 | Metrics older than 24 hours are deleted and cannot be queried by default API lookbacks. | ✓ VERIFIED | 24h cutoff + delete path in `apps/api/src/services/metrics.ts:15`, `apps/api/src/services/metrics.ts:138`; query clamp in `apps/api/src/services/metrics.ts:19` and `apps/api/src/services/telemetryQuery.ts:162`; retention test in `apps/api/src/__tests__/metrics-ingest-retention.test.ts:118`. |
| 3 | Retention behavior is deterministic and proven by automated tests. | ✓ VERIFIED | Deterministic helper functions + retention assertions in `apps/api/src/services/metrics.ts:15` and `apps/api/src/__tests__/metrics-ingest-retention.test.ts:118`. |
| 4 | User can request telemetry history windows of 15m/1h/6h/24h and receive scoped trend data. | ✓ VERIFIED | Allowed windows declared in `apps/api/src/services/telemetryQuery.ts:6` + routed validation in `apps/api/src/routes/metrics.ts:18`; history query path and trend SQL in `apps/api/src/services/telemetryQuery.ts:153` and `apps/api/src/services/telemetryQuery.ts:310`; contract test in `apps/api/src/__tests__/metrics-routes-and-stream.test.ts:101`. |
| 5 | User receives streaming telemetry frames with KPI aggregates and top contributors. | ✓ VERIFIED | Websocket fan-out sends `aggregate`, `topContributors`, `restartIndicators` in `apps/api/src/websocket/server.ts:239`; frame builder in `apps/api/src/services/telemetryQuery.ts:351`. |
| 6 | Live controls can pause/resume and apply speed presets without changing ingest. | ✓ VERIFIED | Control parsing/application in `apps/api/src/websocket/server.ts:93`, `apps/api/src/websocket/server.ts:114`, throttle in `apps/api/src/websocket/server.ts:139`, ingest still writes in `apps/api/src/websocket/server.ts:208`; tests in `apps/api/src/__tests__/metrics-routes-and-stream.test.ts:194` and `apps/api/src/__tests__/metrics-routes-and-stream.test.ts:215`. |
| 7 | Fleet view shows KPI cards for CPU, memory, network, and restarts. | ✓ VERIFIED | KPI card render paths in `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:357` through `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:385`; panel mounted in fleet view at `apps/web/src/components/fleet/FleetInventoryView.tsx:235`. |
| 8 | User can pause/resume live telemetry and change speed presets while preserving context. | ✓ VERIFIED | Controls UI in `apps/web/src/components/telemetry/TelemetryControls.tsx:26` and `apps/web/src/components/telemetry/TelemetryControls.tsx:54`; websocket control sends in `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:308` and `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:341`. |
| 9 | User can switch 15m/1h/6h/24h windows and trend data updates in telemetry panel. | ✓ VERIFIED | Window controls in `apps/web/src/components/telemetry/TelemetryControls.tsx:36`; history reload effect keyed by `windowPreset` in `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:169` and `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:213`. |
| 10 | Multi-container scope shows aggregate KPIs plus top contributors list. | ✓ VERIFIED | Aggregate and contributors state/render in `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:143`, `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:388`; contributor list component in `apps/web/src/components/telemetry/TopContributorsList.tsx:28`. |
| 11 | Telemetry focus follows selected host/container from fleet inventory interactions. | ✓ VERIFIED | Inventory selection state in `apps/web/src/components/fleet/FleetInventoryView.tsx:57`/`apps/web/src/components/fleet/FleetInventoryView.tsx:58`; passed into telemetry scope at `apps/web/src/components/fleet/FleetInventoryView.tsx:238` and `apps/web/src/components/fleet/FleetInventoryView.tsx:239`. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/api/src/services/metrics.ts` | Docker ID to UUID mapping + retention helpers | ✓ VERIFIED | Exists, substantive ingest/cleanup logic, wired via websocket ingest call in `apps/api/src/websocket/server.ts:4` and `apps/api/src/websocket/server.ts:208`. |
| `prisma/schema.prisma` | Container metric indexes for retention/lookbacks | ✓ VERIFIED | `ContainerMetric` with timestamp indexes in `prisma/schema.prisma:241` and `prisma/schema.prisma:252`. |
| `apps/api/src/__tests__/metrics-ingest-retention.test.ts` | Regression coverage for mapping + 24h boundary | ✓ VERIFIED | Substantive tests for mapping/unmatched/retention in `apps/api/src/__tests__/metrics-ingest-retention.test.ts:69`, `apps/api/src/__tests__/metrics-ingest-retention.test.ts:95`, `apps/api/src/__tests__/metrics-ingest-retention.test.ts:118`. |
| `apps/api/src/services/telemetryQuery.ts` | Windowed history + aggregate/top contributor query helpers | ✓ VERIFIED | Full scoped query and frame builder implementation; consumed by route and websocket layers (`apps/api/src/routes/metrics.ts:4`, `apps/api/src/websocket/server.ts:6`). |
| `apps/api/src/routes/metrics.ts` | Tenant-scoped telemetry history/live API | ✓ VERIFIED | Query validation + scope enforcement + history/live responses; mounted at `apps/api/src/index.ts:52`. |
| `apps/api/src/websocket/server.ts` | Scope-aware telemetry stream and live controls | ✓ VERIFIED | Subscribe/control protocol, fan-out throttling, and frame broadcast implemented and invoked by server upgrade hook in `apps/api/src/index.ts:76`. |
| `apps/api/src/__tests__/metrics-routes-and-stream.test.ts` | API/stream contract tests | ✓ VERIFIED | Covers window validation, scope, payload shape, and stream control semantics. |
| `apps/web/src/lib/api.ts` | Typed telemetry API/socket contracts | ✓ VERIFIED | Telemetry types, fetch helpers, socket creation, and message parsing/builders used by KPI panel. |
| `apps/web/src/components/telemetry/TelemetryControls.tsx` | Pause/resume, speed presets, window chips | ✓ VERIFIED | Renders all required controls and callbacks; imported/used in `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:18`. |
| `apps/web/src/components/telemetry/TopContributorsList.tsx` | Top contributors ranking display | ✓ VERIFIED | Renders contributor list and selection callback; used in `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:19` and `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:388`. |
| `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx` | KPI telemetry surface and live wiring | ✓ VERIFIED | Fetch + websocket + controls + KPI cards implemented; embedded in fleet view. |
| `apps/web/src/components/fleet/FleetInventoryView.tsx` | Inventory context auto-follow into telemetry scope | ✓ VERIFIED | Host/container selection state passes into telemetry props and selection callback. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `apps/api/src/services/metrics.ts` | `prisma/schema.prisma` | Container lookup by hostId + dockerId before metric writes | ✓ WIRED | `prisma.container.findMany` with `hostId` + `dockerId in [...]` then mapped to `createMany` containerId (`apps/api/src/services/metrics.ts:75`). |
| `apps/api/src/services/metrics.ts` | `ContainerMetric.timestamp` | Retention delete cutoff based on now-24h | ✓ WIRED | `getMetricsRetentionCutoff` and `deleteMany({ where: { timestamp: { lt: cutoff }}})` in `apps/api/src/services/metrics.ts:138`. |
| `apps/api/src/routes/metrics.ts` | `apps/api/src/services/telemetryQuery.ts` | Validated window preset drives history query | ✓ WIRED | `z.enum(TELEMETRY_WINDOWS)` validation + `getTelemetryHistory` invocation (`apps/api/src/routes/metrics.ts:18`, `apps/api/src/routes/metrics.ts:48`). |
| `apps/api/src/websocket/server.ts` | telemetry API contract | Shared telemetry frame shape (`aggregate`, `topContributors`) | ✓ WIRED | Websocket frames send same KPI fields as API route snapshots (`apps/api/src/websocket/server.ts:239`, `apps/api/src/routes/metrics.ts:94`). |
| `apps/web/src/components/fleet/FleetInventoryView.tsx` | `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx` | Selected host/container passed as telemetry scope | ✓ WIRED | `hostId={expandedHostId}` and `containerId={selectedContainerId}` at `apps/web/src/components/fleet/FleetInventoryView.tsx:238`. |
| `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx` | `apps/web/src/lib/api.ts` | History fetch + websocket live stream controls | ✓ WIRED | Imports and uses telemetry fetch/socket/control helpers (`apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:4`, `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:216`, `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:314`). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `METR-01` | `05-01-PLAN.md`, `05-02-PLAN.md`, `05-03-PLAN.md` | User can view live container metrics updates (CPU, memory, network, restart indicators). | ✓ SATISFIED | API/websocket live frame contract + frontend KPI render + controls: `apps/api/src/websocket/server.ts:239`, `apps/web/src/components/telemetry/TelemetryKpiPanel.tsx:357`. |
| `METR-02` | `05-02-PLAN.md`, `05-03-PLAN.md` | User can view recent metrics history windows (15m, 1h, 6h, 24h). | ✓ SATISFIED | Window enums/validation/query and client window controls: `apps/api/src/services/telemetryQuery.ts:6`, `apps/api/src/routes/metrics.ts:18`, `apps/web/src/components/telemetry/TelemetryControls.tsx:36`. |
| `METR-03` | `05-01-PLAN.md` | Platform can retain metrics samples for at least 24 hours in MVP. | ✓ SATISFIED | 24h retention cutoff + cleanup + lookback clamp + regression coverage: `apps/api/src/services/metrics.ts:3`, `apps/api/src/services/metrics.ts:138`, `apps/api/src/__tests__/metrics-ingest-retention.test.ts:118`. |

All requirement IDs declared in plan frontmatter (`METR-01`, `METR-02`, `METR-03`) are present in `.planning/REQUIREMENTS.md` and mapped to Phase 5. No orphaned Phase 5 requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/api/src/services/metrics.ts` | 146 | `console.log` in cleanup job | ℹ️ Info | Operational logging only; does not block telemetry goal.

### Human Verification Required

### 1. Fleet telemetry stream renders live KPI changes

**Test:** Open fleet view with at least one connected host reporting metrics and watch KPI cards for 30-60 seconds.
**Expected:** CPU/memory/network/restart cards update over time for current scope.
**Why human:** Requires live runtime data and browser rendering.

### 2. Pause/resume and speed presets affect live cadence

**Test:** While stream is active, click pause, resume, then change speed (1x/2x/4x).
**Expected:** Updates stop when paused, restart on resume, and cadence changes with speed preset.
**Why human:** End-to-end websocket timing and UX feedback cannot be fully proven statically.

### 3. History window switching updates trend context

**Test:** Toggle 15m, 1h, 6h, and 24h chips in telemetry controls.
**Expected:** Trend bars and snapshot context refresh for each selected window without leaving fleet page.
**Why human:** Visual data interpretation and interaction flow need manual confirmation.

### Gaps Summary

No code-level gaps were found in must-have truths, artifacts, or key links. Remaining verification is human-only UX/runtime confirmation for real-time behavior.

---

_Verified: 2026-03-04T17:56:53.144Z_
_Verifier: Claude (gsd-verifier)_
