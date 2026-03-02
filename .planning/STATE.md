# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-01)

**Core value:** Operators can securely observe and control Docker containers across many hosts from one place without exposing inbound ports on customer infrastructure.
**Current focus:** Phase 2 - Identity, Access, and Tenant Isolation

## Current Position

Phase: 2 of 8 (Identity, Access, and Tenant Isolation)
Plan: 6 of 6 in current phase
Status: Phase 2 complete
Last activity: 2026-03-02 - Completed 02-06 dashboard logout shell plan.

Progress: [██████░░░░] 56.3%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 4 min
- Total execution time: 0.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 0 min | 0 min |
| 2 | 6 | 35 min | 6 min |
| 3-8 | 0 | 0 min | 0 min |

**Recent Trend:**
- Last 5 plans: 02-02, 02-03, 02-04, 02-05, 02-06
- Trend: Improving

*Updated after each plan completion*
- Latest execution: Phase 02 Plan 06 | 3 min | 2 tasks | 2 files

## Accumulated Context

### Decisions

Decisions are logged in `.planning/PROJECT.md` Key Decisions table.
Recent decisions affecting current work:

- [Phase 1] Keep existing self-hosted mode as first-class during SaaS migration.
- [Phase 2] Enforce Owner/Admin/Operator/Viewer RBAC as MVP baseline.
- [Phase 3] Use outbound-only host-agent connectivity (no inbound customer-host ports).
- [Phase 5] Keep telemetry retention bounded for MVP cost control.
- [Phase 02]: Use shared zod schemas for login/register payload parsing to keep API contracts deterministic.
- [Phase 02]: Regenerate and explicitly save server sessions on register/login to mitigate session fixation risk.
- [Phase 02]: Use /auth/me as the web session-restore source of truth and clear UI state on logout before redirect.
- [Phase 02-identity-access-and-tenant-isolation]: Resolve org authorization context once in middleware (req.scope) so handlers stay fail-closed and policy-consistent.
- [Phase 02-identity-access-and-tenant-isolation]: Use a shared role matrix helper for organization/project checks instead of inline role branching.
- [Phase 02-identity-access-and-tenant-isolation]: Persist selected organization on the client and require explicit org context in fleet interactions.
- [Phase 02]: Enforce invite/member mutation constraints through shared roleMatrix helpers instead of route-specific branching.
- [Phase 02]: Use scoped middleware (requireOrgPermission) to keep owner/admin gates consistent before mutation handlers run.
- [Phase 02]: Use shared scopedAccess service as single org/project boundary enforcement layer.
- [Phase 02]: Require explicit tenant context and scope-bound primary queries for hosts/actions/audit to prevent cross-tenant leakage.
- [Phase 02]: Standardize alerts/webhooks on requireOrgScope/requireOrgPermission with scope-constrained primary lookups to prevent authorization drift.
- [Phase 02]: Gate SECU-01 non-identity paths with a deterministic apps/api tenant-isolation vitest suite executed via npm test.
- [Phase 02]: Use a shared (dashboard) route-group layout to keep primary nav and sign-out mounted across authenticated pages.
- [Phase 02]: Execute logout cleanup in finally: clear selected organization scope and redirect to /login even when logout API errors.

### Pending Todos

From `.planning/todos/pending/`.

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-02 16:38
Stopped at: Completed 02-06-PLAN.md
Resume file: None
