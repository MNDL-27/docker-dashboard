---
phase: 02-identity-access-and-tenant-isolation
plan: 04
subsystem: api
tags: [tenant-isolation, rbac, express, prisma]
requires:
  - phase: 02-03
    provides: shared org scope and role enforcement baseline
provides:
  - fail-closed scoped access service for organization/project checks
  - hosts/actions/audit routes constrained by scope-bound queries
  - agent ingest routes validated against organization/project host scope
affects: [phase-03-host-connectivity, phase-04-fleet]
tech-stack:
  added: []
  patterns: [centralized scopedAccess resolver, scoped query helper composition]
key-files:
  created: [apps/api/src/services/scopedAccess.ts]
  modified: [apps/api/src/middleware/scope.ts, apps/api/src/routes/hosts.ts, apps/api/src/routes/actions.ts, apps/api/src/routes/audit.ts, apps/api/src/middleware/agentAuth.ts, apps/api/src/routes/agent.ts]
key-decisions:
  - "Use a shared scopedAccess service as the single source for org/project boundary checks."
  - "Require explicit tenant context for route-level reads and use scope-constrained primary queries to avoid check-after-fetch leakage."
patterns-established:
  - "Resolve tenant scope once, then compose Prisma where clauses from scope helpers."
  - "Fail closed on missing/invalid tenant context for both user HTTP and agent ingest traffic."
requirements-completed: [TEN-05]
duration: 1 min
completed: 2026-03-02
---

# Phase 2 Plan 4: Tenant Isolation Enforcement Summary

**Scoped tenant guardrails now enforce organization/project boundaries across hosts, actions, audit, and agent ingest paths via shared fail-closed access primitives.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-02T16:05:24Z
- **Completed:** 2026-03-02T16:05:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added centralized scoped access resolvers and query helpers for user and agent paths.
- Replaced permissive or check-after-fetch patterns in hosts/actions/audit with scope-bound primary queries.
- Enforced ingest context validation so heartbeat/container sync reject out-of-scope org/project claims.

## Task Commits

Each task was committed atomically:

1. **Task 1: Introduce reusable scoped-access primitives and wire core data routes** - `b21af7a` (feat)
2. **Task 2: Enforce ingest-path tenant scope using shared scoped-access service** - `7243ef2` (fix)

## Files Created/Modified
- `apps/api/src/services/scopedAccess.ts` - Shared fail-closed scope resolvers and scoped Prisma where helpers.
- `apps/api/src/middleware/scope.ts` - Middleware now resolves org/project scope through shared access service.
- `apps/api/src/routes/hosts.ts` - Host and container reads now require scoped context and scoped primary queries.
- `apps/api/src/routes/actions.ts` - Container action dispatch/audit writes now require valid scoped context.
- `apps/api/src/routes/audit.ts` - Audit access now enforces membership and optional project scoping.
- `apps/api/src/middleware/agentAuth.ts` - Agent token validation now includes project claim checks.
- `apps/api/src/routes/agent.ts` - Heartbeat/container ingest now fail closed on invalid scope.

## Decisions Made
- Centralized tenant checks in `scopedAccess` to prevent route drift and keep org/project validation consistent.
- Required explicit tenant context at route boundaries where implicit fallback could leak out-of-scope records.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added project claim verification in agent auth middleware**
- **Found during:** Task 2 (Enforce ingest-path tenant scope using shared scoped-access service)
- **Issue:** Ingest auth verified only `hostId` and `organizationId`; mismatched `projectId` claim could bypass intended project boundary checks.
- **Fix:** Extended `requireAgentAuth` to validate `projectId` claim against persisted host record before ingest handlers run.
- **Files modified:** `apps/api/src/middleware/agentAuth.ts`
- **Verification:** `npm --prefix apps/api run build`
- **Committed in:** `7243ef2` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix was necessary to keep ingest scope validation complete and fail-closed. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core HTTP and ingest paths now share the same tenant boundary enforcement model.
- Ready for 02-05 while preserving Phase 2 isolation invariants.

---
*Phase: 02-identity-access-and-tenant-isolation*
*Completed: 2026-03-02*

## Self-Check: PASSED
