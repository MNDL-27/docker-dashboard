---
phase: 02-identity-access-and-tenant-isolation
plan: 02
subsystem: auth
tags: [rbac, tenant-isolation, organizations, projects, onboarding]

requires:
  - phase: 02-identity-access-and-tenant-isolation
    provides: auth/session baseline from 02-01 for authenticated org/project flows
provides:
  - Centralized org scope resolution and role matrix enforcement for organization/project routes
  - Organization-first onboarding path for users without tenant membership
  - Explicit organization-scoped project operations in fleet dashboard UX
affects: [phase-02-plan-03, invitation-management, tenant-isolation]

tech-stack:
  added: []
  patterns: [fail-closed organization scope middleware, centralized role matrix checks, client-side selected organization persistence]

key-files:
  created:
    - apps/api/src/authz/roleMatrix.ts
    - apps/api/src/middleware/scope.ts
    - apps/web/src/app/onboarding/organization/page.tsx
  modified:
    - apps/api/src/routes/organizations.ts
    - apps/api/src/routes/projects.ts
    - apps/web/src/app/page.tsx
    - apps/web/src/app/(dashboard)/fleet/page.tsx
    - apps/web/src/lib/api.ts

key-decisions:
  - "Resolve org authorization context once in middleware (`req.scope`) and keep route handlers focused on scoped queries and business behavior."
  - "Use a shared role matrix helper instead of repeated inline role comparisons to keep org/project permission semantics consistent."
  - "Persist selected organization on the client and require explicit organization context for fleet/project interactions."

patterns-established:
  - "Fail-closed org scope: deny when org ID is missing or membership is absent before route logic executes."
  - "Org-first navigation: authenticated users without org membership are redirected to onboarding before dashboard access."

requirements-completed: [TEN-01, TEN-02]

duration: 6 min
completed: 2026-03-02
---

# Phase 2 Plan 02: Organization Scope Foundation Summary

**Tenant boundaries now flow through centralized org scope middleware and role matrix checks, and web users are guided from zero-org onboarding to organization-scoped project creation in fleet UX.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-02T15:39:36Z
- **Completed:** 2026-03-02T15:46:24Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `requireOrgScope` middleware that resolves `{ userId, organizationId, role }` and blocks missing/out-of-scope access by default.
- Refactored organization/project API routes to consume centralized scope + role matrix helpers and keep project queries organization-scoped.
- Implemented first-organization onboarding, org-aware landing redirects, and explicit organization selection with scope-focused error messaging in fleet UI.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add centralized org/project scope resolution and role matrix helpers** - `a613082` (feat)
2. **Task 2: Add organization onboarding and scoped project creation UX** - `ea4b2ce` (feat)

**Plan metadata:** `(pending)`

## Files Created/Modified
- `apps/api/src/authz/roleMatrix.ts` - Shared Owner/Admin/Operator/Viewer permission helpers.
- `apps/api/src/middleware/scope.ts` - Fail-closed organization scope resolution middleware attached to request context.
- `apps/api/src/routes/organizations.ts` - Organization read/update/delete paths now use centralized scope and role checks.
- `apps/api/src/routes/projects.ts` - Project list/create/read/update/delete paths now enforce resolved org scope and matrix-based roles.
- `apps/web/src/app/page.tsx` - Authenticated entrypoint now routes users to onboarding or fleet based on organization membership.
- `apps/web/src/app/onboarding/organization/page.tsx` - New first-run organization creation flow.
- `apps/web/src/app/(dashboard)/fleet/page.tsx` - Organization selector, org-scoped project loading, and permission-focused failure messaging.
- `apps/web/src/lib/api.ts` - Added org fetch/create helpers plus selected-organization persistence utilities.

## Decisions Made
- Centralized org scope resolution in middleware to prevent per-route authz drift and keep handlers fail-closed.
- Reused one role matrix helper for organization/project permission checks instead of ad-hoc inline role branches.
- Chose localStorage-backed selected organization context to keep fleet/project actions explicitly scoped across navigations.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Issues Encountered
- `npm --prefix apps/web run build` cannot complete in current workspace without environment/runtime cleanup:
  - Pre-existing production transport guard in `apps/web/src/lib/transport.ts` rejects non-HTTPS `NEXT_PUBLIC_API_URL`.
  - After temporary HTTPS override, build still fails due pre-existing `AddHostDialogProps.projects` mismatch in `apps/web/src/components/fleet/HostList.tsx`.
- These unrelated blockers were logged to `.planning/phases/02-identity-access-and-tenant-isolation/deferred-items.md` and left out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Organization/project scope primitives are now centralized and reusable for invitation and role-management work in `02-03`.
- Remaining web build blockers in deferred items should be resolved to restore full web verification coverage for upcoming plans.

---
*Phase: 02-identity-access-and-tenant-isolation*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-identity-access-and-tenant-isolation/02-02-SUMMARY.md`
- FOUND: `a613082`
- FOUND: `ea4b2ce`
