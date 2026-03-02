---
phase: 02-identity-access-and-tenant-isolation
plan: 06
subsystem: auth
tags: [nextjs, logout, navigation, tenant-scope]
requires:
  - phase: 02-identity-access-and-tenant-isolation
    provides: Auth/session endpoints and selected-organization client scope helpers from earlier plans.
provides:
  - Shared `(dashboard)` shell with persistent primary navigation.
  - Reachable sign-out action from dashboard navigation on authenticated pages.
  - Deterministic logout cleanup path that clears selected organization scope and redirects to `/login`.
affects: [phase-02-verification, web-auth-ux]
tech-stack:
  added: []
  patterns: [route-group dashboard shell, fail-safe client logout cleanup]
key-files:
  created:
    - apps/web/src/app/(dashboard)/layout.tsx
    - apps/web/src/components/navigation/DashboardShell.tsx
  modified:
    - apps/web/src/components/navigation/DashboardShell.tsx
key-decisions:
  - "Use a shared `(dashboard)` route-group layout so primary navigation (including sign-out) is mounted consistently across authenticated pages."
  - "Run client scope cleanup and `/login` redirect in a `finally` block so logout UX stays deterministic even if API logout fails."
patterns-established:
  - "Dashboard shell pattern: mount reusable navigation in route-group layout rather than duplicating per-page headers."
  - "Logout hardening pattern: call server logout, then clear tenant scope and redirect regardless of API outcome."
requirements-completed: [AUTH-04]
duration: 3 min
completed: 2026-03-02
---

# Phase 2 Plan 6: Dashboard Logout Shell Summary

**A shared dashboard shell now exposes a persistent sign-out control that logs out, clears selected tenant scope on the client, and routes users back to `/login`.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T16:35:16Z
- **Completed:** 2026-03-02T16:38:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `app/(dashboard)/layout.tsx` to wrap dashboard routes in one shared shell.
- Added `DashboardShell` with persistent primary links for fleet, alerts, audit, and settings surfaces.
- Wired sign-out to `logout()` + `clearSelectedOrganizationId()` + `router.replace('/login')`, including error-tolerant cleanup.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shared dashboard shell with primary navigation coverage** - `044ecd0` (feat)
2. **Task 2: Wire sign-out control to logout, scope clear, and redirect** - `837adf7` (feat)

**Plan metadata:** Pending state/docs commit after state updates.

## Files Created/Modified
- `apps/web/src/app/(dashboard)/layout.tsx` - Mounts shared shell around all dashboard routes.
- `apps/web/src/components/navigation/DashboardShell.tsx` - Renders primary nav and fail-safe sign-out flow.

## Decisions Made
- Used route-group layout mounting for persistent navigation coverage across authenticated dashboard routes.
- Kept logout redirect deterministic by clearing client scope and redirecting in `finally`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `NEXT_PUBLIC_API_URL` production HTTPS guardrail blocked default `next build` in this environment; build verification was rerun with `NEXT_PUBLIC_API_URL=https://localhost:4000`.
- `npm --prefix apps/web run build` still fails on a pre-existing unrelated type error in `apps/web/src/components/fleet/HostList.tsx` (`AddHostDialogProps.projects` missing).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AUTH-04 web UX gap is closed via reachable dashboard sign-out.
- Phase 2 plan set is complete and ready for phase transition.

## Self-Check: PASSED
- FOUND: `.planning/phases/02-identity-access-and-tenant-isolation/02-06-SUMMARY.md`
- FOUND: `apps/web/src/app/(dashboard)/layout.tsx`
- FOUND: `apps/web/src/components/navigation/DashboardShell.tsx`
- FOUND commit: `044ecd0`
- FOUND commit: `837adf7`

---
*Phase: 02-identity-access-and-tenant-isolation*
*Completed: 2026-03-02*
