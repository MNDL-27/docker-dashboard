---
phase: 04-fleet-inventory-views
plan: 01
subsystem: api
tags: [inventory, prisma, express, vitest, go-agent]

# Dependency graph
requires:
  - phase: 03-host-enrollment-and-trusted-connectivity
    provides: agent enrollment/authenticated ingest paths and scoped access helpers
provides:
  - Fleet totals contract from GET /hosts (hostCount + containerCount)
  - Host container query contract with scoped search and multi-select filters
  - Expanded snapshot persistence fields for Phase 4 host/container cards
  - Regression suite for INVT-01/02/03 API behavior and isolation guards
affects: [phase-04-plan-02-ui, phase-04-plan-03-hardening, fleet-page-data-binding]

# Tech tracking
tech-stack:
  added: []
  patterns: [backward-compatible ingest payload union, scoped filter validation before query execution]

key-files:
  created:
    - apps/api/src/__tests__/fleet-inventory-routes.test.ts
  modified:
    - prisma/schema.prisma
    - packages/agent/docker/client.go
    - packages/agent/client/api.go
    - apps/api/src/routes/agent.ts
    - apps/api/src/services/container.ts
    - apps/api/src/routes/hosts.ts

key-decisions:
  - "Kept /agent/containers backward compatible by accepting both legacy array payloads and new object payloads with host snapshots."
  - "Implemented label search server-side after scoped query retrieval to keep tenant boundaries intact while supporting JSON label matching."

patterns-established:
  - "Inventory responses include derived fleet aggregates with host cards in one payload."
  - "Filter value validation (hostIds/projectIds/statuses) runs before container query execution."

requirements-completed: [INVT-01, INVT-02, INVT-03]

# Metrics
duration: 8 min
completed: 2026-03-04
---

# Phase 4 Plan 1: Fleet Inventory Contract Summary

**Expanded fleet inventory ingest/schema fields and delivered scoped host/container query contracts with regression coverage for totals, filters, and tenant isolation.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-04T15:51:29Z
- **Completed:** 2026-03-04T16:00:24Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added inventory snapshot persistence fields for host/container cards (including restart count, networks, volumes, and host metadata columns).
- Extended `GET /hosts` and `GET /hosts/:id/containers` contracts for fleet totals plus scoped search/filter validation.
- Added dedicated inventory route regression tests covering INVT-01/02/03 behavior and cross-tenant denial paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand inventory snapshot schema and ingest payload fields** - `20d0f4d` (feat)
2. **Task 2: Extend host inventory routes for aggregate counts and scoped search/filter contract** - `70c6817` (feat)
3. **Task 3: Add API regression tests for Phase 4 inventory contracts** - `e68fadc` (test)

## Files Created/Modified
- `prisma/schema.prisma` - Added host snapshot and container inventory fields used by Phase 4 contracts.
- `packages/agent/docker/client.go` - Added container inspect-derived fields (restart count, created time, networks, volumes).
- `packages/agent/client/api.go` - Added extended snapshot payload structures while preserving legacy sync request compatibility.
- `apps/api/src/routes/agent.ts` - Added payload validation and support for extended inventory sync contract.
- `apps/api/src/services/container.ts` - Persisted expanded container fields and host snapshot metadata transactionally.
- `apps/api/src/routes/hosts.ts` - Added fleet totals, scoped filter validation, and server-side search enforcement.
- `apps/api/src/__tests__/fleet-inventory-routes.test.ts` - Added end-to-end route contract regressions for totals/search/filter/isolation.

## Decisions Made
- Kept existing agent container sync compatibility by supporting both legacy array and extended object payload shapes.
- Enforced filter validation (host/project/status) in-route before querying to prevent scope drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated Prisma client after schema contract expansion**
- **Found during:** Task 1
- **Issue:** TypeScript compile failed because generated Prisma client types did not include newly added host/container fields.
- **Fix:** Ran `npx prisma generate --schema=prisma/schema.prisma` and rebuilt API.
- **Files modified:** generated client artifacts outside task scope (runtime output only)
- **Verification:** `npm --prefix apps/api run build` succeeds.
- **Committed in:** `20d0f4d` (task commit)

**2. [Rule 1 - Bug] Fixed host list JSON serialization and label-search filtering gap**
- **Found during:** Task 3
- **Issue:** `GET /hosts` failed on BigInt serialization, and DB-only name/image query prevented label-only search matches.
- **Fix:** Serialized `memoryTotalBytes` safely and moved final label-aware search filtering to scoped server-side filtering.
- **Files modified:** `apps/api/src/routes/hosts.ts`
- **Verification:** `npm --prefix apps/api run test -- fleet-inventory-routes.test.ts` passes.
- **Committed in:** `70c6817` (task commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required for correctness and successful verification; no scope creep.

## Authentication Gates

None.

## Issues Encountered
- `go test ./... ./packages/agent/...` could not run in this environment because the `go` binary is not installed (`go: command not found`). API/test verification completed; Go verification remains pending on a Go-enabled runner.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Inventory API contracts required by fleet UI work are in place and regression-covered.
- Ready for `04-02-PLAN.md` UI implementation against the new host/container response contracts.

---
*Phase: 04-fleet-inventory-views*
*Completed: 2026-03-04*

## Self-Check: PASSED
