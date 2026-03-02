---
phase: 03-host-enrollment-and-trusted-connectivity
plan: 02
subsystem: api
tags: [enrollment, jwt, websocket, tenant-scope, prisma]
requires:
  - phase: 03-01
    provides: enrollment token issuance and hashed bootstrap token storage
provides:
  - Atomic one-time enrollment token consume flow for first-connect exchange
  - Durable agent credentials with explicit JWT issuer/audience/algorithm profile
  - Cross-transport regression coverage for HTTP and websocket auth policy parity
affects: [agent-connectivity, ingest-auth, websocket-auth, phase-03-plan-03]
tech-stack:
  added: []
  patterns: [compare-and-consume enrollment transaction, shared JWT profile constants]
key-files:
  created: [apps/api/src/__tests__/agent-enrollment-exchange.test.ts]
  modified:
    [
      apps/api/src/services/enrollment.ts,
      apps/api/src/routes/agent.ts,
      apps/api/src/middleware/agentAuth.ts,
      apps/api/src/websocket/auth.ts,
      apps/api/src/__tests__/tenant-isolation.test.ts,
    ]
key-decisions:
  - Keep durable credentials as JWTs and harden verification policy with explicit issuer/audience/algorithm constraints.
  - Centralize first-connect enrollment into a transaction helper that requires exactly one conditional token consume.
patterns-established:
  - "Enrollment exchange only succeeds after conditional token updateMany count === 1"
  - "HTTP middleware and websocket auth use identical JWT verification options"
requirements-completed: [ENRL-03]
duration: 4 min
completed: 2026-03-02
---

# Phase 3 Plan 2: First-Connect Enrollment Exchange Summary

**Atomic compare-and-consume enrollment exchange now issues scoped durable credentials and enforces identical JWT validation policy for HTTP and websocket agent auth.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T17:43:00Z
- **Completed:** 2026-03-02T17:47:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced enroll read-then-update flow with `consumeEnrollmentToken` transaction logic that consumes bootstrap token hashes exactly once before host creation.
- Added deterministic enrollment regression tests covering concurrent replay, invalid token, expired token, and replay-after-success behavior.
- Hardened durable credential verification by requiring explicit JWT algorithm/issuer/audience in both `requireAgentAuth` and `authenticateAgentWS`.
- Added regression assertions for scope mismatch and unsupported JWT profiles to prevent HTTP/websocket policy drift.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace read-then-update enrollment with atomic compare-and-consume exchange** - `179a04c` (feat)
2. **Task 2: Harden durable credential validation across HTTP and websocket agent auth** - `f20dac3` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/api/src/services/enrollment.ts` - Added `consumeEnrollmentToken` transaction helper and enrollment scope return contract.
- `apps/api/src/routes/agent.ts` - Switched `/agent/enroll` to service exchange flow and signed durable tokens with explicit profile claims.
- `apps/api/src/middleware/agentAuth.ts` - Added strict JWT verification constraints and shared auth policy constants.
- `apps/api/src/websocket/auth.ts` - Applied same JWT verification constraints used by HTTP middleware.
- `apps/api/src/__tests__/agent-enrollment-exchange.test.ts` - Added enrollment replay and auth-policy regression coverage.
- `apps/api/src/__tests__/tenant-isolation.test.ts` - Updated websocket token fixtures to match hardened JWT policy.

## Decisions Made
- Kept JWT durable credentials for Phase 3 continuity, but required explicit verification options to close token-profile acceptance gaps.
- Treated bootstrap token consume as the gate for host creation and credential issuance to preserve one-time enrollment invariants under concurrency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing tenant isolation websocket fixtures for strict JWT policy**
- **Found during:** Task 2 (Harden durable credential validation across HTTP and websocket agent auth)
- **Issue:** Existing websocket regression token fixtures lacked issuer/audience claims and failed after policy hardening.
- **Fix:** Added auth-policy constants to the mocked `agentAuth` module and signed websocket fixture tokens with matching issuer/audience/algorithm.
- **Files modified:** apps/api/src/__tests__/tenant-isolation.test.ts
- **Verification:** `npm --prefix apps/api run test -- agent-enrollment-exchange.test.ts`
- **Committed in:** f20dac3 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix preserved existing isolation regression intent and kept transport auth hardening backward-safe for current test suite.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Ready for `03-03-PLAN.md` with enrollment exchange and durable transport auth policy baselined.

---
*Phase: 03-host-enrollment-and-trusted-connectivity*
*Completed: 2026-03-02*

## Self-Check: PASSED
