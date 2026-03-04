---
phase: 06-live-logs-and-retention
plan: 02
subsystem: api
tags: [logs, websocket, express, zod, vitest, retention]
requires:
  - phase: 06-live-logs-and-retention
    provides: host-scoped docker ID mapping and shared log retention helpers from 06-01
provides:
  - Tenant-scoped `/api/logs` read endpoint with requested/delivered retention metadata
  - `logs.subscribe` and `logs.control` websocket contracts with pause and reconnect mode handling
  - LOGS-01/LOGS-02/LOGS-04 regression tests for scope safety, pending cap, and reconnect semantics
affects: [live-log-streaming, retention-ux, reconnect-policy]
tech-stack:
  added: []
  patterns: [scoped access validation before log reads, per-socket logs state for pause/reconnect, capped pending badge semantics]
key-files:
  created: [apps/api/src/routes/logs.ts, apps/api/src/__tests__/logs-stream-contract.test.ts]
  modified: [apps/api/src/services/logs.ts, apps/api/src/websocket/server.ts, apps/api/src/index.ts]
key-decisions:
  - "Use scopedAccess resolution plus scoped container checks as a fail-closed gate before `/api/logs` queries."
  - "Treat reconnect mode as explicit websocket contract state (`backfill` or `now`) with `logs.status` updates and paused pending counters."
patterns-established:
  - "Logs read responses always return retention metadata with requested/delivered ranges and trim flags."
  - "Paused websocket clients accumulate pending lines and expose capped badge text (`999+`) while delivery is halted."
requirements-completed: [LOGS-01, LOGS-02, LOGS-04]
duration: 6 min
completed: 2026-03-04
---

# Phase 6 Plan 2: Live Logs and Retention Summary

**Scoped live logs contracts now enforce tenant/container boundaries with deterministic pause/reconnect behavior and retention-aware read metadata for backfill and empty-window UX.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T19:48:21Z
- **Completed:** 2026-03-04T19:54:34Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added authenticated `/api/logs` route with org/project/host/container scope validation and retention range metadata (`requestedRange`, `deliveredRange`, `trimmed`).
- Replaced global log websocket broadcast with scoped `logs.subscribe`/`logs.control` contracts, per-socket pause state, pending count badges, and reconnect mode controls (`backfill` vs `now`).
- Added contract tests proving scoped denial paths, deferred-feature exclusions, pause pending cap behavior, and reconnect-mode control semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tenant-scoped logs read endpoint with retention trim metadata** - `3b9bbaf` (feat)
2. **Task 2: Implement scoped websocket logs subscribe/control with pause semantics and reconnect modes** - `c002d4d` (feat)
3. **Task 3: Add websocket and route contract tests for scope, pause, pending cap, and reconnect behavior** - `10b6845` (test)

**Plan metadata:** pending final docs commit

## Files Created/Modified
- `apps/api/src/routes/logs.ts` - New authenticated logs read endpoint with strict scoped access and range validation.
- `apps/api/src/services/logs.ts` - Added logs scope resolver, range query helper with retention metadata, and scoped live-line mapping helper.
- `apps/api/src/websocket/server.ts` - Added logs subscribe/control/status contracts and per-socket scoped fan-out with paused pending handling.
- `apps/api/src/index.ts` - Mounted `/api/logs` behind existing UI API limiter.
- `apps/api/src/__tests__/logs-stream-contract.test.ts` - Added route + websocket contract coverage for LOGS-01/02/04 guardrails.

## Decisions Made
- Standardized logs read contract metadata so API consumers can distinguish fully available, trimmed, and empty retention windows without inferring from line count alone.
- Kept telemetry stream controls isolated from logs stream state by introducing dedicated logs client state structures and helper builders.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API now exposes bounded, tenant-safe logs read + stream contracts required for Plan 06-03 web integration and export UX wiring.
- Reconnect mode and pause/pending behaviors are now contract-tested and ready for frontend consumption.

---
*Phase: 06-live-logs-and-retention*
*Completed: 2026-03-04*

## Self-Check: PASSED

- Found summary file at `.planning/phases/06-live-logs-and-retention/06-live-logs-and-retention-02-SUMMARY.md`.
- Found task commits: `3b9bbaf`, `c002d4d`, `10b6845` in repository history.
