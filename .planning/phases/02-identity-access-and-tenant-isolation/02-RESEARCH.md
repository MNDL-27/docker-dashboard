# Phase 2: Identity, Access, and Tenant Isolation - Research

**Researched:** 2026-03-02
**Domain:** Multi-tenant authn/authz in Express + Prisma + PostgreSQL
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Users can create accounts, log in, remain authenticated across sessions, and log out cleanly.
- Organizations and projects are first-class scopes, and users only see scopes they belong to.
- Owner/Admin/Operator/Viewer roles are enforced consistently in API and UI behavior.
- Tenant isolation is enforced fail-closed across all data access paths so out-of-scope records are never returned.

### Claude's Discretion
- Auth/session implementation details (cookie session vs token-based flow) if security and UX requirements are met.
- Authorization architecture (central policy engine or consolidated middleware/service layer) if role checks stay consistent.
- Invitation UX mechanics (email invite, link-based invite, or local-dev-friendly manual onboarding) if membership boundaries remain strict.

### Deferred Ideas (OUT OF SCOPE)
- Host enrollment token lifecycle, durable agent credentials, and heartbeat trust model (Phase 3).
- Fleet inventory parity, telemetry ingestion/retention, logs UX, and actions/alerts features (Phases 4-8).
- Enterprise identity extensions like SSO/SAML/SCIM/MFA beyond MVP email/password requirements.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEN-01 | User can create an organization tenant. | Organization create flow with owner bootstrap membership in one transaction; unique slug constraint and membership checks. |
| TEN-02 | User can create projects within an organization to segment environments. | Org-scoped project create/list with role gate and `organizationId` enforced in all project queries. |
| TEN-03 | User can invite another user to an organization. | Invite token model, expiration, single-use acceptance transaction, and email-agnostic local-dev invite link support. |
| TEN-04 | User can assign membership roles (Owner, Admin, Operator, Viewer). | Central RBAC middleware/service, deterministic role matrix, and protected role transitions. |
| TEN-05 | User can access only data for organizations and projects they belong to. | Scope-first query pattern, deny-by-default middleware, and optional DB RLS backstop for fail-closed isolation. |
| AUTH-01 | User can create an account with email and password. | Input validation + bcrypt hashing + unique email + immediate authenticated session creation. |
| AUTH-02 | User can log in with email and password. | Credential verification + session regeneration to prevent fixation + secure cookie/session store. |
| AUTH-03 | User can refresh or continue an authenticated session without re-entering credentials. | Server-side session store (`express-session` + `connect-pg-simple`) with cookie maxAge/rolling strategy. |
| AUTH-04 | User can log out and invalidate active session state. | Session destroy + cookie clear + server-side invalidation check on subsequent requests. |
| SECU-01 | Platform enforces tenant isolation on all API and data access paths. | Mandatory scoped query helpers, cross-tenant tests, and fail-closed behavior when scope context is missing. |
</phase_requirements>

## Summary

Phase 2 should standardize on server-side cookie sessions with PostgreSQL-backed session storage and centralized authorization context resolution (user + org/project memberships + effective role) before any business handler runs. This aligns with the existing stack (`express-session`, `connect-pg-simple`, Prisma/Postgres) and minimizes operational complexity versus introducing JWT token rotation and revocation mechanics in this phase.

For tenant isolation, the critical planning decision is to enforce a scope-first data access pattern: every data query must include organization/project constraints as part of the primary `where` clause, not as an afterthought. Prisma schema already has strong tenant primitives (`organizationId`, `projectId`, composite unique memberships), so the plan should consolidate repeated ad-hoc checks into reusable guardrails and verification tests.

Given the security requirement is fail-closed, the phase plan should include both app-layer isolation guarantees (middleware + scoped services) and at least one hard backstop. The strongest backstop is PostgreSQL Row-Level Security (RLS), which is default-deny when enabled and no policy matches; if full RLS is deferred, planning must still include strict helper boundaries and negative tests to ensure out-of-scope rows are never returned.

**Primary recommendation:** Use cookie-based server sessions + centralized RBAC/scope middleware + mandatory scoped Prisma query helpers, with fail-closed defaults and explicit cross-tenant denial tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^4.18.2` | HTTP API for auth/membership/tenant endpoints | Already integrated in `apps/api`; stable middleware ecosystem. |
| `express-session` | `^1.18.1` | Server-side session lifecycle | Officially supports secure cookie controls, regenerate/destroy flow. |
| `connect-pg-simple` | `^10.0.0` | Persist sessions in PostgreSQL | Production-safe alternative to memory store; prune/TTL controls. |
| `@prisma/client` + `prisma` | `^7.4.1` | Data access, schema, transactions | Existing schema already models org/project/membership/roles cleanly. |
| `bcrypt` | `^5.1.1` | Password hashing/verification | Mature, battle-tested password hashing for Node auth flows. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^3.24.0` | Request body/query validation | Validate all auth/invite/role mutation payloads before DB writes. |
| `cors` | `^2.8.5` | Cross-origin credential support | Required for web app cookie auth with `credentials: true`. |
| `pg` | `^8.19.0` | Postgres pool for sessions and Prisma datasource | Session store pool + DB connectivity in local/hosted modes. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server sessions (`express-session`) | JWT access/refresh tokens | JWT adds revocation/rotation complexity; not needed to satisfy current phase requirements. |
| App-layer-only tenant checks | PostgreSQL RLS policies | RLS improves fail-closed guarantees but adds migration/policy complexity; good backstop if included now. |
| Consolidated middleware/service authorization | External policy engine | Strong long-term governance, but unnecessary overhead for current MVP role matrix. |

**Installation:**
```bash
npm install express-session connect-pg-simple bcrypt zod @prisma/client
npm install -D prisma
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── middleware/         # auth/session bootstrap + org/project scope guards
├── authz/              # role matrix, effective-role resolver, policy helpers
├── services/           # scoped Prisma access (all queries require scope context)
├── routes/             # thin handlers; no direct ad-hoc tenant checks
└── lib/                # prisma client + typed request context helpers
```

### Pattern 1: Request Authorization Context (Fail-Closed)
**What:** Resolve `{ userId, organizationId?, projectId?, orgRole?, projectRole? }` once per request and attach to request context.
**When to use:** All authenticated routes; reject if required scope is missing.
**Example:**
```typescript
// Source: https://github.com/expressjs/session#readme
// Source: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints
export async function requireOrgContext(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  const orgId = req.params.orgId ?? req.body.organizationId ?? req.query.organizationId;
  if (!orgId) return res.status(400).json({ error: 'Organization ID is required' });

  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: req.session.userId, organizationId: orgId } },
  });

  if (!membership) return res.status(403).json({ error: 'Not a member of this organization' });
  req.authz = { userId: req.session.userId, organizationId: orgId, orgRole: membership.role };
  next();
}
```

### Pattern 2: Scope-First Querying
**What:** Enforce tenant constraints directly inside every Prisma `where` clause.
**When to use:** Any read/write for tenant-owned entities.
**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query
const hosts = await prisma.host.findMany({
  where: {
    organizationId: ctx.organizationId,
    ...(ctx.projectId ? { projectId: ctx.projectId } : {}),
  },
});
```

### Pattern 3: Transactional Invite Acceptance
**What:** Create membership + mark invite accepted atomically.
**When to use:** `POST /invites/:token/accept` and other membership mutations with multi-step writes.
**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
await prisma.$transaction([
  prisma.organizationMember.create({ data: { userId, organizationId: invite.organizationId, role: invite.role } }),
  prisma.organizationInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
]);
```

### Anti-Patterns to Avoid
- **Check-after-fetch authorization:** do not fetch global records by `id` and authorize later; scope queries up front.
- **Route-level role logic duplication:** avoid embedding custom role conditions in every handler; centralize policy helpers.
- **Session write without regeneration on login:** invites session fixation risk; regenerate SID before setting user identity.
- **Permit-by-default guards:** missing org/project context must deny, never continue with broad query behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom crypto/hash wrapper | `bcrypt` | Password hashing edge cases/cost tuning are security-critical. |
| Session storage | In-memory/session DIY table logic | `express-session` + `connect-pg-simple` | Correct expiry, touch, and cleanup behavior is already solved. |
| Input validation | Manual `if` chains in each route | `zod` schemas | Reduces inconsistent validation and auth bypass via malformed input. |
| Transaction orchestration | Ad-hoc multi-write retry logic | Prisma `$transaction` | Prevents partial invite/membership writes and race bugs. |
| Tenant policy plumbing | Per-route bespoke checks | Shared authz middleware + scoped service layer | Enforces consistent fail-closed behavior across endpoints. |

**Key insight:** Identity and tenancy bugs usually come from inconsistency, not missing primitives. Reuse proven auth/session/query primitives and centralize policy enforcement.

## Common Pitfalls

### Pitfall 1: Session Fixation on Login
**What goes wrong:** User logs in but keeps old session ID.
**Why it happens:** Setting `req.session.userId` without `req.session.regenerate()`.
**How to avoid:** Regenerate session before storing auth identity; then save.
**Warning signs:** Same session ID before/after login in local tests.

### Pitfall 2: Secure Cookies Failing Behind Proxy
**What goes wrong:** Auth appears broken in production; cookies not set/sent.
**Why it happens:** `cookie.secure=true` without correct `trust proxy` when TLS terminates at reverse proxy.
**How to avoid:** Configure `app.set('trust proxy', ...)` per deployment topology.
**Warning signs:** Login succeeds but subsequent `/me` returns 401 in hosted env only.

### Pitfall 3: Cross-Tenant Leakage Through Derived Queries
**What goes wrong:** Nested relation queries return records from unauthorized org/project.
**Why it happens:** Filtering by entity ID only and assuming earlier checks are enough.
**How to avoid:** Include `organizationId`/`projectId` predicates in every query path.
**Warning signs:** Tests pass for happy paths but no negative out-of-scope assertions exist.

### Pitfall 4: Inconsistent Role Semantics Between Endpoints
**What goes wrong:** Same role can perform action on one endpoint but not another.
**Why it happens:** Scattered inline role comparisons.
**How to avoid:** Single role matrix and helper methods used by all handlers.
**Warning signs:** Repeated string role checks (`'OWNER'`, `'ADMIN'`, etc.) across many files.

### Pitfall 5: Invite Replay or Race Conditions
**What goes wrong:** Same invite accepted twice or membership/invite state diverges.
**Why it happens:** Non-atomic accept flow.
**How to avoid:** Accept in transaction with uniqueness constraints and accepted/expiry checks.
**Warning signs:** Duplicate membership attempts or orphaned pending invites after acceptance.

## Code Examples

Verified patterns from official sources:

### Express Session (Server-Side)
```typescript
// Source: https://github.com/expressjs/session#readme
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
}));
```

### Prisma Composite Membership Lookup
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints
const membership = await prisma.organizationMember.findUnique({
  where: {
    userId_organizationId: {
      userId,
      organizationId,
    },
  },
});
```

### Prisma Transaction for Atomic Multi-Step Writes
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
await prisma.$transaction(async (tx) => {
  await tx.organizationMember.create({ data: { userId, organizationId, role } });
  await tx.organizationInvite.update({ where: { id: inviteId }, data: { acceptedAt: new Date() } });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma middleware (`$use`) for global query interception | Prisma Client extensions (`$extends` with `query`) | Prisma docs now steer to extensions for query lifecycle customization | Better typed and composable per-request extended clients for auth/tenant concerns. |
| Route-by-route authz checks | Centralized request context + policy helpers | Current best practice in multi-tenant Node APIs | Lower drift and easier auditability of role enforcement. |
| App-only tenant checks | App checks + optional DB RLS backstop | RLS increasingly common for strict SaaS isolation | Stronger fail-closed guarantees against accidental query omissions. |

**Deprecated/outdated:**
- Relying on in-memory session store in production: `express-session` explicitly warns `MemoryStore` is not for production.

## Open Questions

1. **Should PostgreSQL RLS be part of Phase 2 or deferred?**
   - What we know: RLS is default-deny when enabled and no matching policy exists.
   - What's unclear: Team appetite for adding policy/migration complexity in this phase.
   - Recommendation: Include minimal RLS for highest-risk tenant tables now; defer full-table coverage if schedule risk emerges.

2. **Role assignment granularity at project level in MVP**
   - What we know: Org roles are locked; project membership model exists.
   - What's unclear: Whether UI/API must expose explicit per-project overrides in this phase.
   - Recommendation: Plan org-level role correctness first, with project-level inherited behavior as baseline.

## Sources

### Primary (HIGH confidence)
- Repository codebase (`apps/api`, `apps/web`, `prisma/schema.prisma`) - current stack and implementation constraints.
- https://github.com/expressjs/session#readme - session options, security, regenerate/destroy, production store warning.
- https://github.com/voxpelli/node-connect-pg-simple#readme - Postgres session store behavior and options.
- https://www.prisma.io/docs/orm/prisma-client/queries/transactions - transaction patterns and isolation guidance.
- https://www.prisma.io/docs/orm/prisma-client/client-extensions/query - query extension patterns for centralized behavior.
- https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints - compound key usage for membership checks.
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html - RLS semantics, default deny, policy behavior.
- https://expressjs.com/en/guide/behind-proxies.html - trust proxy impacts for secure cookies/protocol.

### Secondary (MEDIUM confidence)
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html - security hygiene guidance for auth flows and error handling.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from repo dependencies and official library docs.
- Architecture: MEDIUM - validated against official docs plus repository patterns; some choices are implementation strategy.
- Pitfalls: MEDIUM - grounded in docs and current code inspection, but require phase tests to confirm all edge cases.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01
