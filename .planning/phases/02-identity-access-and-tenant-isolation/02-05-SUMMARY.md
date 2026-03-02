---
phase: 02-identity-access-and-tenant-isolation
plan: 05
subsystem: api
tags: [tenant-isolation, websocket, alerts, webhooks, vitest]
requires:
  - phase: 02-04
    provides: scopedAccess service and fail-closed middleware baseline for core routes
provides:
  - fail-closed tenant scope enforcement on alerts, webhooks, and websocket agent handshake paths
  - deterministic tenant-isolation regression suite covering HTTP, ingest, and websocket scope checks
affects: [phase-03-host-connectivity, phase-08-alerting]
tech-stack:
  added: [vitest, supertest, @types/supertest]
  patterns: [requireOrgScope+requireOrgPermission for route guards, scope-constrained primary lookups, tenant isolation regression testing]
key-files:
  created: [apps/api/src/__tests__/tenant-isolation.test.ts]
  modified: [apps/api/src/routes/alerts.ts, apps/api/src/routes/webhooks.ts, apps/api/src/websocket/auth.ts, apps/api/src/middleware/scope.ts, apps/api/package.json, apps/api/package-lock.json]
key-decisions:
  - "Route-level tenant checks for alerts/webhooks now standardize on requireOrgScope/requireOrgPermission plus scoped primary lookups."
  - "Tenant isolation regressions are enforced through a dedicated deterministic vitest suite wired to npm test in apps/api."
patterns-established:
  - "Fail closed in realtime/auth paths by requiring organization and project scope claims to resolve against persisted host scope."
  - "Protect cross-tenant boundaries with negative tests that span HTTP routes, ingest handlers, and websocket authentication."
requirements-completed: [SECU-01]
duration: 7 min
completed: 2026-03-02
---

# Phase 2 Plan 5: Realtime/Notification Tenant Isolation Summary

**Alerts/webhooks/http ingest/websocket access paths now share fail-closed tenant scope enforcement, with deterministic regression tests guarding cross-tenant leakage.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T16:08:46Z
- **Completed:** 2026-03-02T16:15:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced route-local membership/role checks in alerts and webhooks with shared scope middleware and scoped primary lookups.
- Hardened websocket agent authentication to require host + organization + project scope validation via shared scoped access service.
- Added a tenant-isolation regression suite that seeds two organizations and validates negative/positive behavior across hosts, actions, audit, alerts, webhooks, ingest, and websocket auth.

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply fail-closed scoped access to alerts, webhooks, and websocket auth paths** - `0238187` (fix)
2. **Task 2: Add automated cross-tenant regression suite for hardened non-identity surfaces** - `2ca3bcd` (test)

## Files Created/Modified
- `apps/api/src/routes/alerts.ts` - applies `requireOrgScope`/`requireOrgPermission` and scoped lookups for tenant-safe alert operations.
- `apps/api/src/routes/webhooks.ts` - applies shared scope middleware and tenant-scoped webhook ownership checks.
- `apps/api/src/websocket/auth.ts` - enforces fail-closed agent websocket scope validation including project scope.
- `apps/api/src/middleware/scope.ts` - treats `projectId="null"` as org-wide scope to preserve route contract while staying fail-closed.
- `apps/api/src/__tests__/tenant-isolation.test.ts` - regression coverage for cross-tenant denial and in-tenant success controls.
- `apps/api/package.json` - adds deterministic tenant-isolation test scripts.
- `apps/api/package-lock.json` - locks added test dependencies.

## Decisions Made
- Standardized alerts and webhooks on the shared scope middleware path to eliminate per-route authorization drift.
- Used a dedicated tenant-isolation test script as the CI/local gate for SECU-01 regression coverage on non-identity surfaces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved `projectId=null` org-wide filter semantics under scoped middleware**
- **Found during:** Task 1 (Apply fail-closed scoped access to alerts, webhooks, and websocket auth paths)
- **Issue:** Switching alerts/webhooks to `requireOrgScope` would interpret `projectId="null"` as a literal project ID and incorrectly deny org-wide list filters.
- **Fix:** Updated scope middleware project resolution to normalize `"null"`/empty values to undefined while keeping real project IDs validated.
- **Files modified:** `apps/api/src/middleware/scope.ts`
- **Verification:** `npm --prefix apps/api run test` and `npm --prefix apps/api run build`
- **Committed in:** `0238187` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix preserved existing API contract and prevented false-deny behavior while maintaining fail-closed isolation.

## Issues Encountered
- Direct ad-hoc websocket smoke execution against built output attempted to initialize Prisma without runtime DB/env context; replaced with deterministic isolated regression tests that validate hostile-scope websocket/ingest behavior without external setup.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SECU-01 now has regression coverage across remaining realtime/notification surfaces and should fail fast on cross-tenant leakage regressions.
- Phase 2 is ready for completion/transition planning.

---
*Phase: 02-identity-access-and-tenant-isolation*
*Completed: 2026-03-02*

## Self-Check: PASSED
