---
phase: 03-host-enrollment-and-trusted-connectivity
verified: 2026-03-02T18:03:46Z
status: gaps_found
score: 8/9 must-haves verified
gaps:
  - truth: "Per-host rate limits throttle abusive API/ingest traffic without globally blocking healthy hosts."
    status: partial
    reason: "Rate limiting is wired for agent enrollment/heartbeat/containers, but no limiter is applied to UI API routes (`/api/*`), leaving SECU-03 only partially implemented."
    artifacts:
      - path: "apps/api/src/index.ts"
        issue: "Only `/agent/enroll`, `/agent/heartbeat`, and `/agent/containers` use rate limit middleware; UI API mounts are unthrottled."
      - path: "apps/api/src/middleware/rateLimit.ts"
        issue: "Limiter factory exposes only agent-focused buckets (enrollBootstrap/heartbeat/containerIngest)."
    missing:
      - "Add and wire UI API rate limiter(s) for `/api/*` user-facing routes per SECU-03."
  - truth: "Planned fleet host list artifact is wired into the active UI path."
    status: failed
    reason: "`HostList.tsx` exists and is substantive, but it is not imported/used by any page or parent component."
    artifacts:
      - path: "apps/web/src/components/fleet/HostList.tsx"
        issue: "Orphaned component (no imports/usages found under `apps/web/src`)."
    missing:
      - "Wire `HostList` into fleet/project screens or remove/replace this must-have artifact in plan scope."
---

# Phase 3: Host Enrollment and Trusted Connectivity Verification Report

**Phase Goal:** Operators can enroll hosts through secure one-time bootstrap and trust fleet presence status.
**Verified:** 2026-03-02T18:03:46Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Operator can generate a one-time enrollment token for scoped org/project intent. | ✓ VERIFIED | `POST /hosts/tokens` enforces scope/role and issues token via `issueEnrollmentToken` (`apps/api/src/routes/hosts.ts:108`, `apps/api/src/routes/hosts.ts:123`, `apps/api/src/routes/hosts.ts:144`). |
| 2 | Operator sees copy-ready install snippet with cloud URL + token. | ✓ VERIFIED | API returns `cloudUrl`, `command`, `token`, `expiresAt` (`apps/api/src/routes/hosts.ts:163`); dialog renders command and clipboard copy (`apps/web/src/components/fleet/AddHostDialog.tsx:117`, `apps/web/src/components/fleet/AddHostDialog.tsx:69`). |
| 3 | Bootstrap secret is short-lived and stored server-side in protected form only. | ✓ VERIFIED | SHA-256 token hashing + TTL before persistence; plaintext only returned once (`apps/api/src/services/enrollment.ts:127`, `apps/api/src/services/enrollment.ts:129`, `apps/api/src/services/enrollment.ts:145`). |
| 4 | Valid first-connect token exchanges exactly once to durable credentials. | ✓ VERIFIED | Atomic `updateMany` consume gate (`count===1`) + host creation + JWT issuance (`apps/api/src/services/enrollment.ts:160`, `apps/api/src/services/enrollment.ts:169`, `apps/api/src/routes/agent.ts:46`). |
| 5 | Invalid/expired/replayed enrollment attempts are rejected deterministically. | ✓ VERIFIED | `/agent/enroll` returns 401 on failed consume and tests cover invalid/expired/replay paths (`apps/api/src/routes/agent.ts:40`, `apps/api/src/__tests__/agent-enrollment-exchange.test.ts:154`). |
| 6 | Durable credentials are bound to host/org/project across HTTP and websocket auth. | ✓ VERIFIED | Shared JWT policy constants + claim verification in middleware and websocket auth (`apps/api/src/middleware/agentAuth.ts:43`, `apps/api/src/websocket/auth.ts:24`). |
| 7 | Online/offline status is derived from one heartbeat freshness policy. | ✓ VERIFIED | Canonical `deriveHostConnectivity` and `recordHeartbeat` used by host and agent routes (`apps/api/src/services/presence.ts:21`, `apps/api/src/routes/hosts.ts:47`, `apps/api/src/routes/agent.ts:86`). |
| 8 | Fleet UI shows connectivity status and last-seen from API source-of-truth. | ✓ VERIFIED | Project hosts view renders `host.status`/`host.lastSeen` from `/api/hosts` response (`apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx:108`, `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx:216`, `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx:222`). |
| 9 | Per-host rate limits throttle abusive API/ingest traffic without collateral blocking. | ✗ FAILED | Host-isolated limiters exist for agent paths, but UI API endpoints are not rate-limited in app mounts (`apps/api/src/index.ts:42`, `apps/api/src/index.ts:46`). |

**Score:** 8/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/api/src/routes/hosts.ts` | Enrollment token endpoint + snippet response | ✓ VERIFIED | Exists, substantive, mounted via `/hosts` in API index (`apps/api/src/index.ts:41`). |
| `apps/api/src/services/enrollment.ts` | Token issue/hash + atomic consume helpers | ✓ VERIFIED | `issueEnrollmentToken` and `consumeEnrollmentToken` implemented and used by routes. |
| `apps/web/src/components/fleet/AddHostDialog.tsx` | Enrollment generation + copy UI | ✓ VERIFIED | 222 lines, used by fleet/project pages (`apps/web/src/app/(dashboard)/fleet/page.tsx:12`, `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx:6`). |
| `apps/api/src/routes/agent.ts` | First-connect enrollment exchange endpoint | ✓ VERIFIED | `/agent/enroll` implemented and mounted (`apps/api/src/index.ts:45`). |
| `apps/api/src/middleware/agentAuth.ts` | Strict durable credential validation | ✓ VERIFIED | Enforces JWT profile + persisted host scope binding. |
| `apps/api/src/services/presence.ts` | Canonical heartbeat freshness policy | ✓ VERIFIED | Exported policy consumed in `hosts`, `agent`, `enrollment`. |
| `apps/api/src/middleware/rateLimit.ts` | Host-keyed limiter policies | ⚠️ PARTIAL | Agent limiter buckets implemented; no UI API limiter bucket for SECU-03 coverage. |
| `apps/web/src/components/fleet/HostList.tsx` | Fleet status + last-seen rendering | ⚠️ ORPHANED | 198-line component exists but has no import/usage in `apps/web/src` (grep result: only self-reference). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `AddHostDialog.tsx` | `/api/hosts/tokens` | `issueHostEnrollmentToken` -> `apiFetch POST` | WIRED | `issueHostEnrollmentToken` called in dialog and maps to `/api/hosts/tokens` (`apps/web/src/components/fleet/AddHostDialog.tsx:54`, `apps/web/src/lib/api.ts:154`). |
| `routes/hosts.ts` | `services/enrollment.ts` | enrollment token issuance | WIRED | Imports and calls `issueEnrollmentToken` and `buildEnrollmentInstallCommand` (`apps/api/src/routes/hosts.ts:6`, `apps/api/src/routes/hosts.ts:144`). |
| `routes/agent.ts` | `services/enrollment.ts` | `POST /agent/enroll` exchange | WIRED | `consumeEnrollmentToken(prisma, payload)` used in enroll route (`apps/api/src/routes/agent.ts:38`). |
| `agentAuth.ts` | `websocket/auth.ts` | shared JWT claim validation rules | WIRED | Websocket auth imports and uses `AGENT_JWT_*` constants in `jwt.verify` options. |
| `routes/agent.ts` | `services/presence.ts` | heartbeat updates/status derivation | WIRED | `recordHeartbeat()` used for heartbeat and container sync writes. |
| `index.ts` | `middleware/rateLimit.ts` | route-level limiter application | PARTIAL | Wired for agent routes only; no limiter wiring on `/api/*` UI routes. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ENRL-01 | `03-01-PLAN.md` | User can create a host record and generate a one-time enrollment token. | ✓ SATISFIED | Token generated via UI/API (`apps/web/src/components/fleet/AddHostDialog.tsx:54`, `apps/api/src/routes/hosts.ts:108`); host record created on first-connect consume (`apps/api/src/services/enrollment.ts:187`). |
| ENRL-02 | `03-01-PLAN.md` | User can view install snippet with cloud URL and token. | ✓ SATISFIED | API response includes `cloudUrl` + `command`; UI renders and copies command (`apps/api/src/routes/hosts.ts:163`, `apps/web/src/components/fleet/AddHostDialog.tsx:117`). |
| ENRL-03 | `03-02-PLAN.md` | Platform validates enrollment token and issues durable credentials on first connect. | ✓ SATISFIED | Atomic consume gate + JWT issuance with deterministic failure for invalid tokens (`apps/api/src/services/enrollment.ts:160`, `apps/api/src/routes/agent.ts:46`). |
| ENRL-04 | `03-03-PLAN.md` | Platform marks host online/offline from heartbeat freshness. | ✓ SATISFIED | Shared freshness policy and route usage (`apps/api/src/services/presence.ts:21`, `apps/api/src/routes/hosts.ts:47`). |
| ENRL-05 | `03-03-PLAN.md` | User can see host status and last-seen timestamp. | ✓ SATISFIED | Hosts UI renders status and last-seen from API payload (`apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx:216`, `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx:222`). |
| SECU-03 | `03-03-PLAN.md` | Platform rate-limits UI API traffic and agent ingest per host. | ✗ BLOCKED | Agent route limiters are present (`apps/api/src/index.ts:42`-`apps/api/src/index.ts:44`), but no limiter applied to UI API route mounts (`apps/api/src/index.ts:46`-`apps/api/src/index.ts:49`). |

Requirement ID accounting check:
- Plan frontmatter IDs found: `ENRL-01`, `ENRL-02`, `ENRL-03`, `ENRL-04`, `ENRL-05`, `SECU-03`.
- Matching entries found in `.planning/REQUIREMENTS.md` traceability table (`.planning/REQUIREMENTS.md:128`-`.planning/REQUIREMENTS.md:132`, `.planning/REQUIREMENTS.md:155`).
- Orphaned phase-3 requirements in `REQUIREMENTS.md`: none.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/web/src/components/fleet/HostList.tsx` | n/a | Orphaned implementation (no imports/usages) | ⚠️ Warning | Planned artifact not active in user flow; increases drift risk. |

### Human Verification Required

### 1. Enrollment Snippet UX

**Test:** In dashboard, open Add Host dialog, generate token for a project, copy command.
**Expected:** Command includes current cloud URL/token, copy feedback appears, and generated command works on a fresh host.
**Why human:** Clipboard/browser UX and real host install execution cannot be fully validated via static code checks.

### 2. Presence Trust Behavior

**Test:** Enroll a host, stop heartbeats past threshold, then resume heartbeats.
**Expected:** UI flips ONLINE -> OFFLINE -> ONLINE with sensible last-seen timestamps and no confusing stale state.
**Why human:** End-to-end timing behavior and usability clarity across UI refresh cycles need runtime observation.

### Gaps Summary

Phase 3 core enrollment exchange and heartbeat-driven presence logic are substantially implemented and wired. However, goal achievement is blocked by one security coverage gap (SECU-03 partial: no UI API route throttling) and one plan-contract drift gap (`HostList.tsx` artifact is not wired into active screens). These gaps should be closed before marking the phase fully complete.

---

_Verified: 2026-03-02T18:03:46Z_
_Verifier: Claude (gsd-verifier)_
