# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-01)

**Core value:** Operators can securely observe and control Docker containers across many hosts from one place without exposing inbound ports on customer infrastructure.
**Current focus:** Phase 6 - Live Logs and Retention

## Current Position

Phase: 6 of 8 (Live Logs and Retention)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-03-04 - Completed execute-plan for 06-01 (log ingest mapping and retention guardrails).

Progress: [██████████] 100.0%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 5 min
- Total execution time: 1.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 0 min | 0 min |
| 2 | 6 | 35 min | 6 min |
| 3 | 3 | 14 min | 5 min |
| 4-8 | 1 | 8 min | 8 min |

**Recent Trend:**
- Last 5 plans: 04-01, 04-02, 04-03, 05-02, 05-03
- Trend: Stable

*Updated after each plan completion*
- Latest execution: Phase 05 Plan 03 | 13 min | 3 tasks | 6 files
| Phase 03 P04 | 3 | 3 tasks | 3 files |
| Phase 04 P01 | 8 min | 3 tasks | 7 files |
| Phase 04 P02 | 8 min | 3 tasks | 7 files |
| Phase 04 P03 | 2 min | 3 tasks | 3 files |
| Phase 05 P01 | 4 min | 3 tasks | 3 files |
| Phase 05 P02 | 4 min | 3 tasks | 5 files |
| Phase 05 P03 | 13 min | 3 tasks | 6 files |
| Phase 06-live-logs-and-retention P01 | 4m | 3 tasks | 4 files |

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
- [Phase 04]: Kept /agent/containers backward compatible by accepting legacy array and extended object payload shapes.
- [Phase 04]: Applied scoped validation for host/project/status filters before container queries to keep tenant boundaries fail-closed.
- [Phase 04]: Keep /fleet as a single-page host-card drill-down surface with inline expansion.
- [Phase 04]: Apply filters only from committed appliedFilters state while draft edits stay local to the panel.
- [Phase 04]: Persist inventory density as a client localStorage preference with Detailed fallback.
- [Phase 04]: Differentiate true no-host scope from filter-driven no-results to preserve applied filter context.
- [Phase 04]: Expose an informational Open Docker action in host no-container state without adding deferred control features.
- [Phase 04]: Use auto-advance to auto-approve Plan 04-03 human verification checkpoint.
- [Phase 05]: Drop unmatched Docker ID metrics during ingest with host-scoped counters instead of persisting invalid relations.
- [Phase 05]: Clamp default telemetry lookback to the shared 24-hour retention cutoff so history queries cannot include older samples by default.
- [Phase 05]: Expose telemetry history and live snapshot under /api/metrics with required organization scope and optional project/host/container filters to keep tenant boundaries fail-closed.
- [Phase 05]: Keep ingest cadence unchanged and apply pause/resume/speed controls only to websocket fan-out emission timing.
- [Phase 05-metrics-telemetry-core]: Use Top N default of 5 in web telemetry contracts with server subscribe-ack override.
- [Phase 05-metrics-telemetry-core]: Keep fleet telemetry scope anchored to expanded host and optional selected container from inventory interactions.
- [Phase 05-metrics-telemetry-core]: Apply pause/resume/speed controls to websocket fan-out while history window switches continue trend refresh.
- [Phase 06]: Set log retention to 24h with shared cutoff/clamp helpers reused by cleanup and range calculations.
- [Phase 06]: Map host-scoped docker IDs to internal container UUIDs before log writes and drop unmatched rows with structured counters.

### Pending Todos

From `.planning/todos/pending/`.

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed 06-live-logs-and-retention-01-PLAN.md
Resume file: .planning/phases/06-live-logs-and-retention/06-02-PLAN.md
