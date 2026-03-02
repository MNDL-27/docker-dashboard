---
phase: 02-identity-access-and-tenant-isolation
plan: 03
subsystem: auth
tags: [rbac, invites, organization-membership, express, nextjs]

requires:
  - phase: 02-02
    provides: centralized org scope resolution and shared role matrix baseline
provides:
  - Centralized invite/member mutation policy for OWNER/ADMIN/OPERATOR/VIEWER flows
  - Transactional invite acceptance with deterministic denial responses for invalid states
  - Members settings dashboard with role-aware invite, role edit, and member removal controls
affects: [tenant-isolation, collaboration, dashboard-settings]

tech-stack:
  added: []
  patterns: ["Policy helpers for role mutations", "Org-scope permission middleware", "Role-gated UI controls from API role data"]

key-files:
  created:
    - apps/web/src/app/(dashboard)/settings/members/page.tsx
    - apps/web/src/components/settings/InviteMemberForm.tsx
    - apps/web/src/components/settings/MemberRoleTable.tsx
  modified:
    - apps/api/src/routes/invites.ts
    - apps/api/src/authz/roleMatrix.ts
    - apps/api/src/middleware/scope.ts
    - apps/web/src/lib/api.ts

key-decisions:
  - "Enforce invite/member mutation constraints through shared roleMatrix helpers instead of route-specific branching."
  - "Use scoped middleware (requireOrgPermission) to keep owner/admin gates consistent before mutation handlers run."

patterns-established:
  - "Mutation authorization pattern: scope middleware + roleMatrix decision helper + explicit 4xx response"
  - "Settings UX pattern: derive affordances from current org role and disable/hide unauthorized actions"

requirements-completed: [TEN-03, TEN-04]

duration: 7 min
completed: 2026-03-02
---

# Phase 2 Plan 03: Collaboration Roles Summary

**Organization invite acceptance and member role lifecycle now run through centralized RBAC decisions with a members settings dashboard that enforces role-gated collaboration actions.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T15:49:51Z
- **Completed:** 2026-03-02T15:57:07Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Refactored invite creation/acceptance, role update, and member removal APIs to use shared policy helpers and org-scope guards.
- Enforced deterministic invite acceptance behavior for expired, already-used, mismatched-email, and already-member cases.
- Added a new members settings page with invite form and member role table that exposes privileged controls only to owners/admins.

## Task Commits

Each task was committed atomically:

1. **Task 1: Finalize invitation lifecycle with strict role-gated membership mutations** - `a223cf5` (feat)
2. **Task 2: Build member management dashboard surface for invites and roles** - `c25fd50` (feat)

## Files Created/Modified
- `apps/api/src/routes/invites.ts` - Centralized invite/member mutation endpoints with scope + role policy checks.
- `apps/api/src/authz/roleMatrix.ts` - Added reusable invite/role-update/member-removal decision helpers.
- `apps/api/src/middleware/scope.ts` - Added `requireOrgPermission` middleware for consistent role-gated scope enforcement.
- `apps/web/src/app/(dashboard)/settings/members/page.tsx` - New members settings dashboard surface.
- `apps/web/src/components/settings/InviteMemberForm.tsx` - Invite form with role selection and admin-only affordances.
- `apps/web/src/components/settings/MemberRoleTable.tsx` - Member list with role edit/remove controls gated by actor role.
- `apps/web/src/lib/api.ts` - Added invite/member API client helpers and membership types.

## Decisions Made
- Enforced all collaboration mutations through one role policy source (`roleMatrix`) to prevent endpoint-level permission drift.
- Kept the members UI aligned with existing dashboard styling and surfaced authorization by disabling/hiding controls rather than introducing a new layout pattern.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm --prefix apps/web run build` is currently blocked by an unrelated pre-existing type error in `apps/web/src/components/fleet/HostList.tsx` (missing `projects` prop for `AddHostDialog`). This is already tracked in `.planning/phases/02-identity-access-and-tenant-isolation/deferred-items.md` and was not changed in this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Invite and membership mutation RBAC behavior is now deterministic at API and UI levels for TEN-03/TEN-04.
- Ready for `02-04-PLAN.md` with collaboration role lifecycle foundations in place.

---
*Phase: 02-identity-access-and-tenant-isolation*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-identity-access-and-tenant-isolation/02-03-SUMMARY.md`
- FOUND: `a223cf5`
- FOUND: `c25fd50`
