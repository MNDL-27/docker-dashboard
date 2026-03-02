# Phase 3: Host Enrollment and Trusted Connectivity - Research

**Researched:** 2026-03-02
**Domain:** Secure host bootstrap, durable agent auth, heartbeat-derived presence, and per-host abuse controls
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Operators can create host records and generate one-time enrollment tokens.
- Enrollment install snippets include the correct cloud URL and token so setup is copy/paste friendly.
- First-connect enrollment token exchange is validated, single-use, and results in durable agent credentials.
- Host online/offline state and last-seen timestamps are derived from heartbeat freshness and shown to users.
- Per-host rate limits protect API and ingest paths from abusive traffic without harming healthy hosts.
- Outbound-only agent connectivity remains mandatory; no inbound customer-host ports are introduced.
- Enrollment bootstrap secrets must be short-lived and single-use enough to prevent replay enrollment.
- Durable agent credentials require protected storage, rotation strategy, and tenant-scoped binding.
- Connectivity state must remain tenant-scoped and consistent with Phase 2 authorization boundaries.

### Claude's Discretion
- Exact token format and credential material (opaque tokens, signed credentials, key pairs) as long as security invariants hold.
- Enrollment UX details (modal, wizard, inline panel) as long as creation and copy flow are clear.
- Heartbeat interval and staleness thresholds as long as status behavior is deterministic and documented.
- Specific throttling algorithm and storage strategy as long as limits are enforced per host.

### Deferred Ideas (OUT OF SCOPE)
- Fleet inventory drill-downs and advanced host/container filtering UX (Phase 4).
- Metrics history, live logs, and retention surfaces (Phases 5-6).
- Container action dispatch workflows, audit trails, and monitor-only controls (Phase 7).
- Alert rule authoring and notification delivery channels (Phase 8).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENRL-01 | User can create a host record and generate a one-time enrollment token. | Host enrollment intent endpoint, short-TTL bootstrap token generation with CSPRNG, hashed-at-rest token storage, and atomic consume semantics. |
| ENRL-02 | User can view an install command/snippet for enrolling an agent with cloud URL and token. | Deterministic snippet builder using `PUBLIC_API_URL`, project/org-bound token reference, and copy-safe CLI command formatting. |
| ENRL-03 | Platform can validate enrollment token and issue durable agent credentials on first connect. | Compare-and-consume transaction, anti-replay token invalidation, durable credential issuance bound to host/org/project, and explicit JWT/credential validation rules. |
| ENRL-04 | Platform can mark host online/offline from heartbeat freshness. | Canonical heartbeat freshness policy (`onlineThresholdMs`) in API/service layer, heartbeat writes to `lastSeen`, and deterministic status computation/sweep job. |
| ENRL-05 | User can see host connectivity status and last-seen timestamp. | Tenant-scoped host list/detail responses include normalized `status` + `lastSeen`; UI renders from API source-of-truth only. |
| SECU-03 | Platform can rate-limit UI API traffic and agent ingest traffic per host. | Route-level rate limiting with host-aware keys (`hostId` after agent auth, fallback token/IP pre-auth), dedicated quotas for enroll/heartbeat/ingest, and shared-store option for multi-instance deployment. |
</phase_requirements>

## Summary

Phase 3 should be planned as a hardening and correctness phase around an already-partial implementation in `apps/api/src/routes/hosts.ts` and `apps/api/src/routes/agent.ts`. The current flow generates bootstrap tokens and enrolls hosts, but token handling is not yet strong enough for anti-replay guarantees under concurrency, durable credentials are long-lived JWTs without a clear rotation primitive, and connectivity status logic is partially computed in route/UI code rather than a single canonical policy.

The safest plan is to keep the existing stack (Express + Prisma + Postgres + ws + Next.js) and upgrade enrollment to a strict compare-and-consume model: generate high-entropy bootstrap secrets, store only a token hash server-side, atomically consume exactly once, and issue durable host credentials bound to tenant scope. For presence, define one heartbeat freshness threshold in shared API logic and make all host list/detail responses derive status from that policy.

For SECU-03, use `express-rate-limit` on UI and agent HTTP paths with per-host keying for agent traffic and separate limits for bootstrap versus steady-state ingest. Keep memory store acceptable for single-instance local/dev; add Redis store support for consistent limits in scaled deployments.

**Primary recommendation:** Implement enrollment as hashed single-use bootstrap + atomic token consumption + tenant-bound durable credentials, then centralize heartbeat status policy and host-keyed rate limiting in middleware.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^4.18.2` | API routes for enroll/heartbeat/ingest | Existing API foundation in `apps/api`. |
| `@prisma/client` + `prisma` | `^7.4.1` | Enrollment persistence + atomic exchange | Existing ORM with transaction/isolation controls. |
| `jsonwebtoken` | `^9.0.3` | Durable signed agent credentials | Already used in `agentAuth` and websocket auth. |
| `node:crypto` (Node 22 LTS runtime) | built-in | CSPRNG token generation + secure comparison primitives | Official CSPRNG and timing-safe utilities. |
| `ws` | `^8.19.0` | Outbound-only realtime connectivity channel | Existing agent/web websocket transport path. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express-rate-limit` | `^7.1.5` (repo baseline) | Per-route traffic shaping for API/ingest | Mandatory for SECU-03 HTTP path controls. |
| `rate-limit-redis` | `4.x` | Shared limiter state across API replicas | Use for prod/multi-instance deployments. |
| `zod` | `^3.24.0` | Strict validation for enroll/heartbeat payloads | Required for deterministic reject paths. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Durable signed JWT host credential | Opaque agent API key pair | Opaque keys simplify revocation-at-rest but require custom verification path and key lookup on every request. |
| In-process limiter store | Redis-backed limiter store | Redis adds infra complexity but is required for accurate cross-instance limits. |
| Status persisted only in DB field | Purely computed status from `lastSeen` | Computed status is deterministic and avoids stale write lag; persisted field helps filtering but can drift without sweeper policy. |

**Installation:**
```bash
npm --prefix apps/api install express-rate-limit rate-limit-redis
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/api/src/
├── routes/
│   ├── hosts.ts              # operator enrollment token/snippet routes
│   └── agent.ts              # enroll exchange + heartbeat + ingest
├── middleware/
│   ├── agentAuth.ts          # durable credential verification + tenant binding
│   └── rateLimit.ts          # host-keyed limiter policies
├── services/
│   ├── enrollment.ts         # token issue/consume/credential issue transaction logic
│   ├── presence.ts           # heartbeat threshold/status derivation
│   └── scopedAccess.ts       # tenant boundary enforcement (Phase 2 carry-forward)
└── websocket/
    └── auth.ts               # WS auth aligned with HTTP agent auth claims/rules
```

### Pattern 1: Compare-and-Consume Enrollment Exchange
**What:** Validate bootstrap token and consume it exactly once in one transaction before issuing durable credentials.
**When to use:** `POST /agent/enroll` first-connect path.
**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions#optimistic-concurrency-control
const now = new Date();

const result = await prisma.$transaction(async (tx) => {
  const consumed = await tx.hostToken.updateMany({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  if (consumed.count !== 1) throw new Error('invalid_or_replayed_token');

  return tx.host.create({
    data: { organizationId, projectId, name, hostname, os, architecture, dockerVersion, lastSeen: now },
  });
});
```

### Pattern 2: Secure Bootstrap Secret Handling
**What:** Generate high-entropy bootstrap secret with CSPRNG, store only hash, never plaintext.
**When to use:** Token creation (`ENRL-01`) and validation (`ENRL-03`).
**Example:**
```typescript
// Source: https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptorandombytessize-callback
import { randomBytes, createHash } from 'node:crypto';

const rawToken = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(rawToken).digest('hex');
```

### Pattern 3: JWT Validation with Explicit Rules
**What:** Verify algorithm, issuer, audience, expiration, and scope claims explicitly.
**When to use:** `requireAgentAuth` and websocket auth for durable credentials.
**Example:**
```typescript
// Source: https://github.com/auth0/node-jsonwebtoken
// Source: https://www.rfc-editor.org/rfc/rfc8725
const claims = jwt.verify(token, secret, {
  algorithms: ['HS256'],
  issuer: 'docker-dashboard-cloud',
  audience: 'docker-dashboard-agent',
});
```

### Pattern 4: Host-Keyed Rate Limiter Policies
**What:** Separate limits by endpoint class and key by authenticated host identity for agent traffic.
**When to use:** `POST /agent/enroll`, `POST /agent/heartbeat`, `POST /agent/containers`.
**Example:**
```typescript
// Source: https://express-rate-limit.mintlify.app/reference/configuration#keygenerator
const heartbeatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: (req) => req.agent?.hostId ?? req.ip,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
```

### Anti-Patterns to Avoid
- **Read-then-update token consumption:** separate read + update without conditional consume enables replay races.
- **Plaintext token persistence:** storing raw bootstrap token in DB raises blast radius on DB leak.
- **Multiple freshness formulas:** status computed differently across API/UI causes trust erosion.
- **Unscoped host credential acceptance:** accepting valid signature without org/project/host binding check violates Phase 2 boundaries.
- **Global limiter keys for agent endpoints:** one abusive host can throttle healthy hosts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cryptographic randomness | Custom pseudo-random token generator | `node:crypto.randomBytes` | Security-critical entropy is solved by core runtime CSPRNG. |
| Enrollment replay prevention | Ad-hoc lock flags in app memory | DB-backed atomic consume in Prisma transaction | Works across processes/restarts and prevents race-condition double enroll. |
| JWT parsing and signature checks | Manual JWT decode/verify logic | `jsonwebtoken.verify` with strict options | Mature implementation with explicit algorithm/audience/issuer controls. |
| Rate limiting middleware | Custom counters in route handlers | `express-rate-limit` (+ Redis store when scaled) | Correct headers, edge handling, and reusable middleware policy. |
| WebSocket liveness probes | Custom ping protocol | `ws` ping/pong heartbeat pattern | Standardized ping/pong semantics and broken-connection handling. |

**Key insight:** Most Phase 3 failures come from race conditions and policy drift, not missing features. Reuse proven primitives and make enrollment/presence rules single-source-of-truth.

## Common Pitfalls

### Pitfall 1: Enrollment Replay via Concurrency Race
**What goes wrong:** Same bootstrap token enrolls more than one host under concurrent requests.
**Why it happens:** Token read and token consume are not coupled by conditional atomic update.
**How to avoid:** Use transaction + conditional `updateMany` (`usedAt: null`, not expired) and require `count === 1`.
**Warning signs:** Duplicate hosts created with identical bootstrap metadata in narrow time window.

### Pitfall 2: Stale/Conflicting Connectivity Status
**What goes wrong:** Host appears online in one API path and offline in another.
**Why it happens:** Status computed in multiple layers with different thresholds.
**How to avoid:** Define one threshold constant and one status derivation service shared by all host responses.
**Warning signs:** UI status flicker or mismatched list/detail status for same host.

### Pitfall 3: Weak Agent JWT Validation
**What goes wrong:** Tokens signed with unexpected algorithm or wrong audience are accepted.
**Why it happens:** `verify()` called without explicit `algorithms`/`audience`/`issuer`.
**How to avoid:** Always pass validation options and reject unknown claim shapes.
**Warning signs:** Auth middleware accepts tokens from other contexts/services.

### Pitfall 4: Host-Scoped Limits Not Actually Host-Scoped
**What goes wrong:** One noisy agent degrades all agents by sharing limiter bucket.
**Why it happens:** Key generator defaults to IP (NAT/proxy collapse).
**How to avoid:** Key agent limiter by authenticated `hostId`; use proxy/trust-proxy-aware config for pre-auth endpoints.
**Warning signs:** Multiple hosts behind same egress IP hit limits together.

### Pitfall 5: Scope Drift Between HTTP and WebSocket Agent Auth
**What goes wrong:** HTTP path rejects out-of-scope token but websocket path accepts it (or inverse).
**Why it happens:** Separate auth implementations with diverging checks.
**How to avoid:** Centralize shared scope verification (`resolveAgentScope`) and claim validation policy.
**Warning signs:** Tenant-isolation tests pass on one transport and fail on the other.

## Code Examples

Verified patterns from official sources:

### ws Broken-Connection Detection
```typescript
// Source: https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
function heartbeat(this: any) {
  this.isAlive = true;
}

wss.on('connection', (ws: any) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
});

setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);
```

### express-rate-limit with Custom Key
```typescript
// Source: https://express-rate-limit.mintlify.app/reference/configuration#keygenerator
import { rateLimit } from 'express-rate-limit';

export const agentIngestLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  keyGenerator: (req) => req.agent?.hostId ?? req.ip,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
```

### Partial Unique Index (subset-only uniqueness)
```sql
-- Source: https://www.postgresql.org/docs/current/indexes-partial.html
CREATE UNIQUE INDEX host_tokens_unused_unique
ON "HostToken" ("tokenHash")
WHERE "usedAt" IS NULL;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Read token then mark used in separate logic | Atomic compare-and-consume update in transaction | Modern ORM/docs emphasize OCC/idempotency patterns | Prevents replay races and duplicate enrollment. |
| Accept JWT with implicit defaults | Explicit algorithm/audience/issuer validation | JWT BCP (RFC 8725) | Reduces alg confusion/substitution risk. |
| Single-process in-memory rate buckets as default for all environments | Middleware limits with optional shared Redis store | express-rate-limit data-store guidance | Consistent enforcement in horizontally scaled API. |

**Deprecated/outdated:**
- Long-lived credential tokens without explicit verification policy (`algorithms`, `issuer`, `audience`) are no longer acceptable for security-sensitive host identity paths.

## Open Questions

1. **Durable credential format choice for Phase 3 (JWT-only vs opaque key pair)**
   - What we know: Both satisfy constraints if tenant-bound and rotatable.
   - What's unclear: Team preference for operational simplicity (JWT) versus DB-first revocation ergonomics (opaque).
   - Recommendation: Keep JWT in Phase 3 for minimal migration, but add explicit claim validation and a credential version/revocation field.

2. **Canonical offline transition mechanism (read-time compute only vs sweeper job + persisted status)**
   - What we know: Requirement is heartbeat freshness-based trust and UI visibility.
   - What's unclear: Whether filtering/reporting needs persisted `OFFLINE` state updates immediately.
   - Recommendation: Compute status at read-time for correctness now; add a lightweight sweeper only if query/filter workloads require persisted state.

3. **Production topology for rate limiter store**
   - What we know: In-memory store is insufficient for strict multi-instance consistency.
   - What's unclear: Whether Phase 3 deploy target is single API instance or horizontally scaled.
   - Recommendation: Implement limiter abstraction now, memory by default, Redis store enabled by env when replicas >1.

## Sources

### Primary (HIGH confidence)
- Repository codebase (`apps/api/src/routes/agent.ts`, `apps/api/src/routes/hosts.ts`, `apps/api/src/middleware/agentAuth.ts`, `apps/api/src/websocket/*`, `prisma/schema.prisma`) - current implementation and constraints.
- https://www.prisma.io/docs/orm/prisma-client/queries/transactions - transaction semantics and retries/isolation guidance.
- https://github.com/websockets/ws#how-to-detect-and-close-broken-connections - ping/pong liveness pattern.
- https://express-rate-limit.mintlify.app/reference/configuration#keygenerator - host-aware limiter keys and options.
- https://express-rate-limit.mintlify.app/reference/stores - store strategy and consistency implications.
- https://www.postgresql.org/docs/current/indexes-partial.html - partial unique index behavior.
- https://www.rfc-editor.org/rfc/rfc8725 - JWT best current practices.
- https://nodejs.org/docs/latest-v22.x/api/crypto.html - CSPRNG and crypto primitives.

### Secondary (MEDIUM confidence)
- https://github.com/auth0/node-jsonwebtoken - library verify/sign options and supported algorithm controls.
- https://expressjs.com/en/guide/behind-proxies.html - trust-proxy implications for IP-derived policies.
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html - one-time token security properties (random, single-use, expiry, secure storage).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - mostly existing repo dependencies plus official docs.
- Architecture: MEDIUM - strong evidence for primitives, but credential-format decision remains discretionary.
- Pitfalls: HIGH - directly observed in current code paths and validated by source guidance.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01
