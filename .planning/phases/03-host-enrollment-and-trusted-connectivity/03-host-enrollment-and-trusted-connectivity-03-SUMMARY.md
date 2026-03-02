---
phase: 03-host-enrollment-and-trusted-connectivity
plan: 03
subsystem: api
tags: [heartbeat, presence, rate-limit, fleet-ui, express]

requires:
  - phase: 03-02
    provides: durable agent JWT credentials and scoped agent context
provides:
  - Shared heartbeat freshness policy for host online/offline state
  - Host-keyed rate limits for enrollment, heartbeat, and container ingest routes
  - Fleet UI rendering aligned to API-provided connectivity status and last-seen fields
affects: [phase-04-fleet-observability, host-connectivity, ingest-hardening]

tech-stack:
  added: [express-rate-limit, rate-limit-redis, ioredis]
  patterns:
    - Shared `deriveHostConnectivity`/`recordHeartbeat` service for deterministic presence
    - Route-mounted limiter middleware with host identity keying and pre-auth token hashing

key-files:
  created:
    - apps/api/src/services/presence.ts
    - apps/api/src/middleware/rateLimit.ts
    - apps/api/src/__tests__/host-presence-and-rate-limit.test.ts
  modified:
    - apps/api/src/routes/hosts.ts
    - apps/api/src/routes/agent.ts
    - apps/api/src/index.ts
    - apps/api/src/services/enrollment.ts
    - apps/web/src/components/fleet/HostList.tsx
    - apps/api/package.json
    - apps/api/package-lock.json

key-decisions:
  - "Use HOST_ONLINE_THRESHOLD_MS in one shared presence service as the single connectivity policy."
  - "Apply rate limiting at mount points in index.ts and key agent buckets by req.agent.hostId."
  - "Hash pre-auth enrollment tokens for limiter keys so abusive bootstrap traffic is isolated without storing plaintext."

patterns-established:
  - "Presence policy: derive status from heartbeat freshness, not persisted status alone."
  - "Throttling policy: isolate abusive traffic by host identity and preserve healthy-host throughput."

requirements-completed: [ENRL-04, ENRL-05, SECU-03]

duration: 5 min
completed: 2026-03-02
---

# Phase 3 Plan 3: Host Presence and Rate Isolation Summary

**Deterministic heartbeat freshness now drives host online/offline state end-to-end, with host-keyed throttling protecting enrollment and ingest paths while fleet UI renders API presence fields directly.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T17:51:57Z
- **Completed:** 2026-03-02T17:57:24Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Added `apps/api/src/services/presence.ts` to centralize heartbeat freshness threshold and connectivity derivation.
- Removed route-level duplicated status logic in host list/detail and switched heartbeat writes to shared `recordHeartbeat` behavior.
- Added `apps/api/src/middleware/rateLimit.ts` and mounted endpoint-specific limiters in `apps/api/src/index.ts` for enrollment, heartbeat, and container ingest.
- Added coverage in `apps/api/src/__tests__/host-presence-and-rate-limit.test.ts` for stale/fresh transitions and host-isolated throttling.
- Updated `apps/web/src/components/fleet/HostList.tsx` to render connectivity and last-seen from API source-of-truth fields.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make heartbeat freshness a single source of truth for host connectivity** - `5e30f1e` (feat)
2. **Task 2: Add per-host limiter middleware for API and ingest endpoints** - `886ca26` (feat)
3. **Task 3: Align fleet UI host cards/table with API connectivity source-of-truth** - `b7877fb` (feat)

**Plan metadata:** Pending

## Files Created/Modified
- `apps/api/src/services/presence.ts` - Canonical `deriveHostConnectivity` and `recordHeartbeat` policy with configurable threshold.
- `apps/api/src/middleware/rateLimit.ts` - Host-keyed limiter factory and Redis-store support behind env config.
- `apps/api/src/__tests__/host-presence-and-rate-limit.test.ts` - Presence and limiter regression tests.
- `apps/api/src/routes/hosts.ts` - Uses shared presence policy for host list/detail payloads.
- `apps/api/src/routes/agent.ts` - Uses shared heartbeat record updates.
- `apps/api/src/index.ts` - Mounts enrollment/heartbeat/container limiter middleware.
- `apps/api/src/services/enrollment.ts` - Uses shared heartbeat writer on first-connect enrollment.
- `apps/web/src/components/fleet/HostList.tsx` - Displays API-driven connectivity labels and last-seen formatting.

## Decisions Made
- Kept heartbeat freshness in one shared service to eliminate status drift between list/detail/heartbeat paths.
- Applied route-level limiters before `/agent` router execution to keep policy explicit and endpoint-specific.
- Enabled Redis-backed limiter storage via `RATE_LIMIT_REDIS_URL` while preserving in-memory default for local/dev.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enrollment host-create typing rejected shared heartbeat status type**
- **Found during:** Task 1
- **Issue:** `EnrollmentConsumeClient.host.create` was constrained to `status: 'ONLINE'`, which failed after switching to shared `recordHeartbeat` return type.
- **Fix:** Broadened the enrollment host-create status type to `HostStatus` in `apps/api/src/services/enrollment.ts`.
- **Files modified:** `apps/api/src/services/enrollment.ts`
- **Verification:** `npm --prefix apps/api run test -- host-presence-and-rate-limit.test.ts && npm --prefix apps/api run build`
- **Committed in:** `5e30f1e`

**2. [Rule 3 - Blocking] Redis store adapter typing mismatch in limiter setup**
- **Found during:** Task 2
- **Issue:** `RedisStore.sendCommand` typing rejected direct spread call to `redis.call`.
- **Fix:** Normalized command splitting (`command` + args) and casted return promise shape for adapter compatibility.
- **Files modified:** `apps/api/src/middleware/rateLimit.ts`
- **Verification:** `npm --prefix apps/api run test -- host-presence-and-rate-limit.test.ts && npm --prefix apps/api run build`
- **Committed in:** `886ca26`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were implementation blockers within planned scope; no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 plan set is complete; enrollment and trusted connectivity requirements are now covered with deterministic status policy and host-isolated throttling.
- Ready for phase transition work and downstream observability features that depend on trustworthy presence state.

---
*Phase: 03-host-enrollment-and-trusted-connectivity*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: `.planning/phases/03-host-enrollment-and-trusted-connectivity/03-host-enrollment-and-trusted-connectivity-03-SUMMARY.md`
- FOUND: `5e30f1e`
- FOUND: `886ca26`
- FOUND: `b7877fb`
