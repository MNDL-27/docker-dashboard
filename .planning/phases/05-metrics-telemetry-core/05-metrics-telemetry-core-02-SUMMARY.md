---
phase: 05-metrics-telemetry-core
plan: 02
subsystem: api
tags: [metrics, telemetry, websocket, prisma, zod, vitest]

requires:
  - phase: 05-metrics-telemetry-core
    provides: telemetry ingest identity mapping and 24h retention boundaries from plan 05-01
provides:
  - tenant-scoped /api/metrics history and live KPI snapshot contracts with locked window presets
  - scope-aware websocket telemetry fan-out with pause/resume and speed controls at render cadence
  - regression tests covering metrics window validation, scope denial, and stream control behavior
affects: [05-03, fleet-kpi-ui, telemetry-contracts]

tech-stack:
  added: []
  patterns:
    - validate telemetry window presets at route boundary with strict zod enums
    - enforce websocket telemetry visibility through explicit metrics.subscribe scope negotiation

key-files:
  created:
    - apps/api/src/services/telemetryQuery.ts
    - apps/api/src/routes/metrics.ts
    - apps/api/src/__tests__/metrics-routes-and-stream.test.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/src/websocket/server.ts

key-decisions:
  - "Expose telemetry history and live snapshot under /api/metrics with required organization scope and optional project/host/container filters to keep tenant boundaries fail-closed."
  - "Keep ingest cadence unchanged and apply pause/resume/speed controls only to websocket fan-out emission timing."

patterns-established:
  - "Telemetry contract shape is KPI-first: aggregate + topContributors + restartIndicators for both history and live frames."
  - "Web clients must subscribe with explicit tenant scope before receiving telemetry stream frames."

requirements-completed: [METR-01, METR-02]

duration: 4 min
completed: 2026-03-04
---

# Phase 5 Plan 02: Tenant-safe telemetry query and stream contracts for KPI observability Summary

**Telemetry APIs and websocket fan-out now deliver tenant-scoped KPI aggregate/top-contributor contracts across 15m/1h/6h/24h windows with live pause/resume and speed controls.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T17:31:08Z
- **Completed:** 2026-03-04T17:34:33Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `apps/api/src/services/telemetryQuery.ts` to resolve scoped telemetry access, run server-side bucketed trend queries, and shape KPI-first aggregate/top contributor payloads.
- Added `apps/api/src/routes/metrics.ts` and mounted it in `apps/api/src/index.ts` for `/api/metrics` history plus `/api/metrics/live` snapshot endpoints with locked `15m|1h|6h|24h` windows.
- Updated `apps/api/src/websocket/server.ts` for scope-aware metrics fan-out, explicit subscribe flow, and pause/resume/speed control handling without changing ingest persistence.
- Added `apps/api/src/__tests__/metrics-routes-and-stream.test.ts` to verify window validation, scoped denial, 24h live contract behavior, and deterministic stream control throttling.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scoped telemetry history API with locked window presets** - `2a30172` (feat)
2. **Task 2: Implement scope-aware telemetry stream fan-out with pause/resume and speed controls** - `652f7e8` (feat)
3. **Task 3: Add API/websocket contract tests for windows, scoping, and telemetry frame shape** - `7dd2b59` (test)

**Plan metadata:** `d01cef5` (docs)

## Files Created/Modified
- `apps/api/src/services/telemetryQuery.ts` - Scope resolution, window presets, bucketed history aggregation, live frame shaping helpers.
- `apps/api/src/routes/metrics.ts` - Authenticated telemetry history/live endpoints with preset and scope validation.
- `apps/api/src/index.ts` - Metrics route registration under `/api/metrics` with API limiter.
- `apps/api/src/websocket/server.ts` - Scope-aware KPI stream fan-out plus pause/resume/speed control messages.
- `apps/api/src/__tests__/metrics-routes-and-stream.test.ts` - Route + stream contract regression coverage for METR-01/02.

## Decisions Made
- Kept telemetry response contracts KPI-first (`aggregate`, `topContributors`, `restartIndicators`) rather than chart-first payload shapes.
- Applied stream controls to fan-out timing only so ingest persistence behavior remains unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stabilized isolated telemetry contract tests under existing API test harness**
- **Found during:** Task 3 (metrics-routes-and-stream.test.ts)
- **Issue:** Importing websocket helpers pulled Prisma initialization in the test runtime and failed before assertions ran.
- **Fix:** Added a local `../lib/prisma` mock and completed mocked telemetry exports required by websocket helpers.
- **Files modified:** apps/api/src/__tests__/metrics-routes-and-stream.test.ts
- **Verification:** `npm --prefix apps/api run test -- metrics-routes-and-stream.test.ts && npm --prefix apps/api run build`
- **Committed in:** `7dd2b59`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was test-harness-only and required for deterministic verification; no product scope creep.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- METR-01/METR-02 backend contracts are in place for fleet KPI UI consumption in Plan 05-03.
- No blockers identified for continuing Phase 5.

---
*Phase: 05-metrics-telemetry-core*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/05-metrics-telemetry-core/05-metrics-telemetry-core-02-SUMMARY.md`
- FOUND commit: `2a30172`
- FOUND commit: `652f7e8`
- FOUND commit: `7dd2b59`
