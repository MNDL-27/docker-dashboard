---
phase: 06-live-logs-and-retention
plan: 01
subsystem: api
tags: [logs, retention, prisma, websocket, vitest]
requires:
  - phase: 05-metrics-telemetry-core
    provides: retention helper and ingest mapping patterns mirrored for logs
provides:
  - Host-scoped docker ID to internal container UUID mapping for log ingest
  - Shared log retention helpers reused by cleanup and range clamping paths
  - LOGS-04 regression coverage for ingest drops and retention boundaries
affects: [live-log-streaming, log-export, retention-ux]
tech-stack:
  added: []
  patterns: [host-scoped identity mapping before persistence, shared retention helper reuse, warning counters for dropped ingest rows]
key-files:
  created: [apps/api/src/__tests__/logs-ingest-retention.test.ts, apps/api/src/config/transport.ts]
  modified: [apps/api/src/services/logs.ts, prisma/schema.prisma]
key-decisions:
  - "Set log retention to 24h and expose getLogRetentionCutoff/clampLogRangeStart for downstream query/export reuse."
  - "Persist source log timestamps when valid and fallback to ingest time for deterministic ordering safety."
patterns-established:
  - "Logs ingest uses hostId+dockerId lookup and drops unmatched rows with structured counters."
  - "Retention deletes and default range starts share the same cutoff helper to avoid policy drift."
requirements-completed: [LOGS-04]
duration: 4 min
completed: 2026-03-04
---

# Phase 6 Plan 1: Live Logs and Retention Summary

**Host-scoped log identity mapping with 24-hour retention clamping and regression tests that enforce LOGS-04 boundary behavior.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T19:40:16Z
- **Completed:** 2026-03-04T19:44:24Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Reworked log ingest buffering to map `hostId + dockerId` to internal `container.id` before `containerLog.createMany` writes.
- Added shared log retention policy helpers and switched cleanup to use a single cutoff source.
- Added a dedicated logs ingest/retention vitest suite covering mapping, unmatched row drops, and partial/full out-of-range clamp behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix log ingest identity mapping and source timestamp persistence** - `a378baf` (feat)
2. **Task 2: Centralize log retention helpers for cleanup and range clamping** - `a10527a` (feat)
3. **Task 3: Add ingest and retention regression tests for LOGS-04 guardrails** - `798b709` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `apps/api/src/services/logs.ts` - Host-scoped container lookup, unmatched-drop warnings, source timestamp coercion, and shared retention helpers.
- `prisma/schema.prisma` - Added `ContainerLog.timestamp` index for retention cleanup and range reads.
- `apps/api/src/__tests__/logs-ingest-retention.test.ts` - Regression coverage for ingest mapping and retention boundaries.
- `apps/api/src/config/transport.ts` - Added missing transport config module required for API build verification.

## Decisions Made
- Aligned log retention to 24 hours to stay consistent with bounded telemetry retention policy.
- Kept cleanup cadence hourly and centralized retention math in helper functions to prevent future drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored missing transport config module required by build**
- **Found during:** Task 1 (Fix log ingest identity mapping and source timestamp persistence)
- **Issue:** `npm --prefix apps/api run build` failed because `src/config/transport` was imported but missing.
- **Fix:** Added `apps/api/src/config/transport.ts` with `getPublicApiUrl` and `assertProdTransport` helpers.
- **Files modified:** `apps/api/src/config/transport.ts`
- **Verification:** `npm --prefix apps/api run build` passed after file restoration.
- **Committed in:** `a378baf` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to satisfy task verification commands; no scope expansion beyond build unblock.

## Issues Encountered
- Initial API build failed due to missing `config/transport` module; resolved inline as blocking fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Log ingestion now persists only FK-safe rows and provides retention helper surface for stream/export query contracts.
- Phase 6 follow-up plans can reuse clamp helper semantics to implement retention UX notices and export metadata.

---
*Phase: 06-live-logs-and-retention*
*Completed: 2026-03-04*

## Self-Check: PASSED

- Found summary file at `.planning/phases/06-live-logs-and-retention/06-live-logs-and-retention-01-SUMMARY.md`.
- Found task commits: `a378baf`, `a10527a`, `798b709` in `git log --oneline --all`.
