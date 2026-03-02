# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-01)

**Core value:** Operators can securely observe and control Docker containers across many hosts from one place without exposing inbound ports on customer infrastructure.
**Current focus:** Phase 4 - Fleet Inventory Views

## Current Position

Phase: 4 of 8 (Fleet Inventory Views)
Plan: 0 of TBD in current phase
Status: Context gathered, ready to plan
Last activity: 2026-03-03 - Completed discuss-phase 4, captured layout, density, filtering, and empty state decisions.

Progress: [██████████] 87.5%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 4 min
- Total execution time: 0.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 0 min | 0 min |
| 2 | 6 | 35 min | 6 min |
| 3 | 3 | 14 min | 5 min |
| 4-8 | 0 | 0 min | 0 min |

**Recent Trend:**
- Last 5 plans: 02-05, 02-06, 03-01, 03-02, 03-03
- Trend: Stable

*Updated after each plan completion*
- Latest execution: Phase 03 Plan 03 | 5 min | 3 tasks | 10 files
| Phase 03 P04 | 3 | 3 tasks | 3 files |

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
- [Phase 03]: Persist only enrollment token hashes and never plaintext bootstrap tokens.
- [Phase 03]: Issue and consume enrollment bootstrap tokens through transaction boundaries for deterministic single-use semantics.
- [Phase 03]: Return cloud URL from API and render one copy-ready install command in fleet UI.
- [Phase 03]: Kept JWT durable credentials and enforced explicit issuer/audience/algorithm constraints for agent auth.
- [Phase 03]: Centralized first-connect enrollment in consumeEnrollmentToken and require updateMany count===1 before host creation.
- [Phase 03]: Use HOST_ONLINE_THRESHOLD_MS in one shared presence service as the single connectivity policy.
- [Phase 03]: Apply rate limiting at mount points in index.ts and key agent buckets by req.agent.hostId.
- [Phase 03]: Hash pre-auth enrollment tokens for limiter keys so abusive bootstrap traffic is isolated without storing plaintext.

### Pending Todos

From `.planning/todos/pending/`.

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-03
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-fleet-inventory-views/04-CONTEXT.md
