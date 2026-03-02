---
phase: 03-host-enrollment-and-trusted-connectivity
plan: 01
subsystem: api
tags: [enrollment, host-token, prisma, react, tenant-scope]

requires:
  - phase: 02-identity-access-and-tenant-isolation
    provides: tenant-scoped role and organization/project boundary enforcement
provides:
  - tenant-scoped host enrollment token issuance with hashed-at-rest bootstrap secrets
  - one-time enrollment command payload with cloud URL, token, and expiry metadata
  - fleet enrollment dialog flow for scoped token generation and command copy
affects: [phase-03-plan-02, phase-03-plan-03, enrollment-handshake]

tech-stack:
  added: []
  patterns:
    - transactional enrollment token issuance and consumption
    - SHA-256 hashing for bootstrap token storage

key-files:
  created:
    - apps/api/src/services/enrollment.ts
    - apps/api/src/__tests__/host-enrollment-token.test.ts
  modified:
    - prisma/schema.prisma
    - apps/api/src/routes/hosts.ts
    - apps/api/src/routes/agent.ts
    - apps/web/src/components/fleet/AddHostDialog.tsx
    - apps/web/src/lib/api.ts
    - apps/web/package.json

key-decisions:
  - "Persist only enrollment token hashes and never plaintext bootstrap tokens."
  - "Issue and consume enrollment bootstrap tokens through transaction boundaries to keep scope and single-use semantics deterministic."
  - "Return cloud URL from API and render one copy-ready install command in fleet UI."

patterns-established:
  - "Enrollment token pattern: generate 32-byte CSPRNG secret, hash with SHA-256, persist hash + expiry only"
  - "Install snippet pattern: API constructs command from trusted cloud URL and ephemeral token response"

requirements-completed: [ENRL-01, ENRL-02]

duration: 5 min
completed: 2026-03-02
---

# Phase 3 Plan 01: Secure Enrollment Token Issuance Summary

**Tenant-scoped host enrollment now issues short-lived hashed bootstrap secrets and returns a deterministic copy-ready install command with cloud URL and token metadata.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T17:30:00Z
- **Completed:** 2026-03-02T17:35:24Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added enrollment service primitives to generate 32-byte bootstrap secrets, hash before persistence, and build install commands from trusted API URL.
- Hardened `POST /hosts/tokens` to enforce OWNER/ADMIN/OPERATOR scope, issue token + intent in one transaction, and return command/token/expiry/cloud URL payload.
- Updated fleet Add Host dialog to call the scoped token endpoint, show project/cloud/expiry context, and support one-click command copy.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tenant-scoped enrollment intent issuance with protected bootstrap secrets** - `680285a` (feat)
2. **Task 2: Update fleet enrollment dialog to show deterministic install snippet** - `5887565` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `apps/api/src/services/enrollment.ts` - Enrollment token generation, hashing, TTL handling, and command builder helpers.
- `apps/api/src/__tests__/host-enrollment-token.test.ts` - Regression tests for hashed-at-rest persistence and issuance permissions.
- `apps/api/src/routes/hosts.ts` - Scoped token issuance endpoint returning token, expiry, cloud URL, and command.
- `apps/api/src/routes/agent.ts` - Enrollment token consumption updated to compare hashed token and atomically mark used.
- `prisma/schema.prisma` - Host token storage schema moved to hashed token field.
- `apps/web/src/lib/api.ts` - Added typed host enrollment token API helper.
- `apps/web/src/components/fleet/AddHostDialog.tsx` - Added project-scoped issuance flow and copy-ready command rendering.
- `apps/web/package.json` - Added lint script for deterministic plan verification.

## Decisions Made
- Store only SHA-256 bootstrap token hashes in persistence to reduce credential exposure risk.
- Use transaction-wrapped issuance/consumption to keep enrollment state changes atomic and replay-resistant.
- Keep install snippet deterministic by relying on API-provided `cloudUrl` plus freshly issued token.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated Prisma client after schema update**
- **Found during:** Task 1 (API build verification)
- **Issue:** TypeScript build failed because generated Prisma types did not yet include `tokenHash`.
- **Fix:** Ran `npm --prefix apps/api run postinstall` to regenerate Prisma client, then re-ran build.
- **Files modified:** none tracked
- **Verification:** `npm --prefix apps/api run test -- host-enrollment-token.test.ts && npm --prefix apps/api run build`
- **Committed in:** `680285a` (part of task commit)

**2. [Rule 3 - Blocking] Added missing web lint script used by plan verification**
- **Found during:** Task 2 (web verify command)
- **Issue:** `npm --prefix apps/web run lint` failed because package script was missing.
- **Fix:** Added `lint` script (`tsc --noEmit`) in `apps/web/package.json`.
- **Files modified:** `apps/web/package.json`
- **Verification:** `npm --prefix apps/web run lint`
- **Committed in:** `5887565` (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to run mandated verification commands; no scope creep.

## Authentication Gates
None.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Enrollment token issuance and snippet UX are complete for ENRL-01 and ENRL-02.
- Ready for `03-02-PLAN.md` to implement first-connect exchange into durable credentials.

---
*Phase: 03-host-enrollment-and-trusted-connectivity*
*Completed: 2026-03-02*

## Self-Check: PASSED
- FOUND: `.planning/phases/03-host-enrollment-and-trusted-connectivity/03-host-enrollment-and-trusted-connectivity-01-SUMMARY.md`
- FOUND: `680285a`
- FOUND: `5887565`
