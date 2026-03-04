---
phase: 05-metrics-telemetry-core
plan: 01
subsystem: api
tags: [metrics, telemetry, prisma, retention, vitest]

requires:
  - phase: 04-fleet-inventory-views
    provides: scoped host/container inventory and websocket ingest foundation
provides:
  - host-scoped Docker ID to container UUID metric ingest mapping
  - deterministic 24-hour metrics retention cutoff helpers and cleanup behavior
  - regression coverage for ingest identity and retention boundary guarantees
affects: [05-02, telemetry-history, websocket-streams, alert-evaluation]

tech-stack:
  added: []
  patterns:
    - host-scoped identity resolution before metric persistence
    - shared retention cutoff helper for cleanup and history defaults

key-files:
  created:
    - apps/api/src/__tests__/metrics-ingest-retention.test.ts
  modified:
    - apps/api/src/services/metrics.ts
    - prisma/schema.prisma

key-decisions:
  - "Drop unmatched Docker ID samples during ingest and log host-scoped mismatch counters instead of persisting invalid foreign keys."
  - "Clamp default metrics lookback starts to retention cutoff so >24h samples are excluded even before cleanup catches up."

patterns-established:
  - "Resolve external identifiers at ingest boundary: map agent Docker IDs to internal UUIDs before createMany writes."
  - "Use one retention cutoff helper for both data deletion and query window defaults to avoid policy drift."

requirements-completed: [METR-01, METR-03]

duration: 4 min
completed: 2026-03-04
---

# Phase 5 Plan 01: Harden telemetry ingest identity mapping and 24h retention enforcement with regression tests Summary

**Telemetry ingest now persists host-scoped container UUID metric rows and enforces deterministic 24-hour retention boundaries proven by automated regressions.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T17:20:19Z
- **Completed:** 2026-03-04T17:24:19Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added hostId + dockerId resolution in metric flush so persisted rows reference valid internal container UUIDs.
- Centralized retention cutoff helpers and cleanup logic with a schema timestamp index for efficient retention/window access.
- Added a dedicated metrics ingest/retention test suite covering mapping correctness, unknown ID drops, and 24h lookback clamping.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix metric ingest identity mapping from Docker IDs to container UUIDs** - `3fe4ec0` (feat)
2. **Task 2: Harden 24-hour retention cutoff and storage/query indexes** - `c432422` (feat)
3. **Task 3: Add regression tests for ingest mapping and retention boundary behavior** - `3a55255` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `apps/api/src/services/metrics.ts` - Host-scoped Docker ID mapping, unmatched sample drops, and shared retention cutoff helpers.
- `prisma/schema.prisma` - Added a `ContainerMetric.timestamp` descending index for retention and lookback efficiency.
- `apps/api/src/__tests__/metrics-ingest-retention.test.ts` - Regression coverage for ingest mapping, unmatched IDs, retention cleanup, and default lookback bounds.

## Decisions Made
- Resolved inbound metric identity by scoped host lookup (`hostId + dockerId`) before persistence to prevent foreign-key drift.
- Made 24-hour retention deterministic by reusing one cutoff helper for cleanup and query default lookbacks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- METR-01 and METR-03 ingest/retention foundations are verified and ready for Plan 05-02 telemetry history/stream contracts.
- No blockers identified for this phase transition.

---
*Phase: 05-metrics-telemetry-core*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/05-metrics-telemetry-core/05-metrics-telemetry-core-01-SUMMARY.md`
- FOUND: `apps/api/src/__tests__/metrics-ingest-retention.test.ts`
- FOUND commit: `3fe4ec0`
- FOUND commit: `c432422`
- FOUND commit: `3a55255`
