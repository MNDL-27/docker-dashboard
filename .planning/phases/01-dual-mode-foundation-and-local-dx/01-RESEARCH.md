# Phase 1: Dual-Mode Foundation and Local DX - Research

**Researched:** 2026-03-02
**Domain:** Dual runtime compatibility, Docker Compose local developer experience, and production transport guardrails
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Existing self-hosted runtime remains functional and documented during cloud migration.
- Developers can start local cloud stack plus local agent through one documented command and complete seed setup.
- Production-facing cloud and agent paths enforce secure transport (HTTPS/WSS), not plaintext HTTP/WS.
- Documentation clearly distinguishes self-hosted mode versus SaaS mode, including when to use each.

| Question | Answer |
|----------|--------|
| What is the primary objective of Phase 1? | Preserve self-hosted continuity while establishing reproducible local SaaS+agent workflows with secure transport defaults. |
| Which requirements are in-scope? | COMP-01, COMP-02, DEVX-01, DEVX-02, and SECU-02 only. |
| Should this phase introduce tenancy/auth? | No. Tenancy, auth, and RBAC begin in Phase 2. |
| What does "one command" mean for developers? | A single documented entrypoint that boots cloud API, cloud web, data services, and local agent, then supports seeded local setup. |
| How strict should transport security be now? | Production configuration must reject non-HTTPS/WSS URLs and fail fast on insecure values. |
| Should legacy mode be rewritten? | No. Keep existing self-hosted behavior first-class; add compatibility boundaries rather than rewrite in this phase. |

### Claude's Discretion
- Exact one-command developer entrypoint (`make`, `npm run`, or wrapper script) as long as docs and behavior are consistent.
- Which compose overlays and helper scripts are used to model local SaaS workflows.
- Specific transport enforcement mechanism (env validation, startup guardrails, reverse-proxy assumptions) as long as insecure production configs fail fast.

### Deferred Ideas (OUT OF SCOPE)
- Multi-tenant identity, organizations/projects, and RBAC enforcement (Phase 2).
- Host enrollment token lifecycle and trusted connectivity model (Phase 3).
- Fleet inventory UX parity, telemetry pipelines, actions hardening, and alerting features (Phases 4-8).
- Broad architecture rewrites unrelated to dual-mode continuity and local DX bootstrapping.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | User can continue using the existing self-hosted dashboard mode after SaaS components are introduced. | Keep `docker-compose.example.yml` as stable self-hosted lane; avoid shared breaking refactors; add explicit mode boundary in docs and commands. |
| COMP-02 | Documentation clearly distinguishes self-hosted and SaaS operating modes. | Split root docs into mode-specific quick starts, env vars, and verification checks with no mixed terminology. |
| DEVX-01 | Developer can start cloud-api, cloud-web, data services, and a local agent using one documented local command. | Use Compose file merge (`-f base -f dev`) with health checks and `up --wait`; wrap in one root command target. |
| DEVX-02 | Developer can follow root documentation for setup, environment variables, and seeded local user flow. | Document deterministic boot + DB schema apply + seed flow; include post-boot checks and first-user creation path. |
| SECU-02 | Platform supports HTTPS/WSS-only transport in production configuration. | Add startup URL/protocol validation guardrails (fail fast in production) for API base URLs, browser API URLs, and agent URLs. |
</phase_requirements>

## Summary

This phase should be planned as a compatibility-and-guardrails phase, not a feature phase. The repository already contains both runtime tracks: legacy self-hosted (`server/`, `public/`, `docker-compose.example.yml`) and cloud-local (`apps/api`, `apps/web`, `packages/agent`, `docker-compose.base.yml`, `docker-compose.dev.yml`). The lowest-risk approach is to preserve these tracks explicitly and add a clean operator-facing mode split in docs and commands.

The current cloud-local stack is close to one-command startup but not deterministic yet: the agent currently requires `AGENT_TOKEN` on first run and exits if missing, and there is no committed Prisma migration history. Planning must include startup sequencing (data services healthy -> schema apply -> app services -> optional seeded flow) to satisfy DEVX requirements reliably.

Transport security is currently permissive (`http://` defaults exist in web, api, and agent flows). For SECU-02, centralize production-only URL validation and fail startup when insecure schemes are configured. Keep local development HTTP/WS allowed to preserve frictionless local DX.

**Primary recommendation:** Plan Phase 1 around three hard deliverables: explicit dual-mode boundary, deterministic one-command local bootstrap, and centralized production HTTPS/WSS startup guards.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docker Compose | v2 (CLI plugin) | Multi-service local orchestration | Officially supports file merging, profiles, health-based dependency gating, and config rendering. |
| Node.js | `>=18` (repo engines) | Runtime for legacy server + cloud API/web build chain | Already required by repo and compatible with current package set. |
| Express | `4.18.2` | HTTP API/server in both legacy and cloud tracks | Existing runtime baseline; lowest migration risk for compatibility phase. |
| Next.js | `15.3.0` | Cloud web app runtime | Already in repo; env model supports strict public/private URL handling. |
| Prisma | `7.4.1` | DB client + schema lifecycle | Current repo standard for cloud API persistence. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostgreSQL | `17-alpine` image | Cloud metadata/session persistence | Required by local SaaS mode. |
| Redis | `7-alpine` image | Cache/queue/session adjacencies | Keep in local stack for parity and future phases. |
| ws | `8.19.0` (api) | WebSocket server/client plumbing | Needed for cloud real-time and agent path transport checks. |
| gorilla/websocket | `1.5.1` (agent) | Agent WS client | Existing agent transport layer; must obey wss in production. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `npm run <target>` wrapper | `make` target | `make` is fine but adds platform variance for Windows contributors. |
| Compose multi-file merge | Compose profiles-only single file | Profiles simplify one file but make mode-specific docs and diffs less explicit. |
| Runtime URL guard in app startup | Reverse-proxy-only enforcement | Proxy-only enforcement misses bad app config early; slower failure feedback. |

**Installation:**
```bash
npm install
docker compose version
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/
├── api/               # Cloud API (local SaaS mode)
├── web/               # Cloud web (local SaaS mode)
packages/
├── agent/             # Local agent runtime for SaaS-local tests
server/                # Legacy self-hosted backend (must remain first-class)
public/                # Legacy self-hosted frontend (must remain first-class)
docker-compose.example.yml   # Self-hosted mode
docker-compose.base.yml      # Shared local SaaS services
docker-compose.dev.yml       # Local SaaS app/agent overlay
```

### Pattern 1: Explicit Dual-Mode Boundary
**What:** Keep two supported run modes with separate entrypoints and docs.
**When to use:** Compatibility phases where self-hosted must keep working during cloud migration.
**Example:**
```text
Mode A (self-hosted): docker compose -f docker-compose.example.yml up -d
Mode B (saas-local): docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up --build --wait
```

### Pattern 2: Deterministic Compose Boot with Health Gates
**What:** Use healthchecks + long-form `depends_on` and wait semantics.
**When to use:** One-command local DX where partial boot is unacceptable.
**Example:**
```yaml
# Source: https://docs.docker.com/reference/compose-file/services/#depends_on
depends_on:
  db:
    condition: service_healthy
  redis:
    condition: service_healthy
```

### Pattern 3: Production Transport Guard at Startup
**What:** Parse configured URLs once at startup and reject insecure schemes in production.
**When to use:** Any environment with `NODE_ENV=production` or explicit production deployment mode.
**Example:**
```ts
// Source: https://nodejs.org/docs/latest-v24.x/api/url.html
function assertSecureUrl(name: string, value: string, allowed: string[]) {
  const u = new URL(value);
  if (!allowed.includes(u.protocol)) {
    throw new Error(`${name} must use ${allowed.join('/')} in production`);
  }
}
```

### Anti-Patterns to Avoid
- **Silent transport downgrade:** allowing `http://`/`ws://` defaults in production paths.
- **Single blended doc path:** one README flow that mixes self-hosted and SaaS-local steps.
- **Assuming container start = ready:** relying on short `depends_on` without health checks.
- **Agent-first boot without enrollment strategy:** starting agent without token/seed path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service boot ordering | Custom polling scripts for every service | Compose `healthcheck` + long-form `depends_on` + `up --wait` | Official behavior is clearer and easier to verify. |
| Compose merge validation | Manual YAML merge logic | `docker compose config` | Official canonical rendering catches merge/interpolation issues early. |
| URL protocol parsing | Regex-based URL checks | WHATWG `URL` parser in Node | Correctly handles schemes/ports/edge cases. |
| Session prod storage logic | MemoryStore fallback in production | Existing Postgres-backed store (`connect-pg-simple`) | MemoryStore is explicitly not production-grade. |

**Key insight:** This phase should integrate existing standards and guards, not invent custom orchestration/security mechanisms.

## Common Pitfalls

### Pitfall 1: Agent crashes in “one-command” flow
**What goes wrong:** Local stack starts but `agent` exits immediately because no enrollment token is provided.
**Why it happens:** Agent requires `AGENT_TOKEN` on first run.
**How to avoid:** Include explicit seeded enrollment path (bootstrap token creation + agent env wiring) in the one-command workflow.
**Warning signs:** `AGENT_TOKEN ... required for first run` in agent logs.

### Pitfall 2: “Healthy” local DX without DB schema readiness
**What goes wrong:** API container is up, but requests fail because schema/tables are missing.
**Why it happens:** No committed migration directory and no guaranteed schema apply step in startup flow.
**How to avoid:** Plan explicit schema application step (`migrate deploy` or `db push` for local prototyping) before app readiness checks.
**Warning signs:** runtime DB relation/table-not-found errors after successful container boot.

### Pitfall 3: Production mixed-content breakage
**What goes wrong:** Browser/API/agent transport works locally but fails or downgrades insecurely in production.
**Why it happens:** `http://` defaults are currently present across codepaths.
**How to avoid:** Enforce startup validation for production URLs (`https:` for HTTP APIs and `wss:` for WebSocket endpoints).
**Warning signs:** browser mixed-content warnings, `ws://` URLs in production logs.

### Pitfall 4: Secure cookies behind proxy not set correctly
**What goes wrong:** Auth sessions appear broken only behind reverse proxy/TLS termination.
**Why it happens:** Express `trust proxy` and secure cookie behavior are misaligned.
**How to avoid:** Configure trusted proxy correctly for production and verify secure cookie behavior end-to-end.
**Warning signs:** login succeeds but session cookie missing/not persisted in production ingress path.

## Code Examples

Verified patterns from official sources:

### Compose file merge and validation
```bash
# Source: https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml config
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up --build --wait
```

### Production URL guardrail
```ts
// Source: https://nodejs.org/docs/latest-v24.x/api/url.html
export function assertProdTransport(name: string, raw: string, allowed: string[]) {
  const parsed = new URL(raw);
  if (!allowed.includes(parsed.protocol)) {
    throw new Error(`${name} must use ${allowed.join(' or ')} in production. Got: ${parsed.protocol}`);
  }
}
```

### Secure proxy-aware Express setup
```ts
// Source: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Start-order only (`depends_on` short form) | Health-gated startup (`condition: service_healthy`) | Compose v2 long-form guidance | Prevents false-ready local stacks. |
| Implicit local-only runtime assumptions | Explicit mode split (self-hosted vs SaaS-local) | Current repo transition phase | Lowers compatibility regressions and docs ambiguity. |
| Ad hoc protocol assumptions | Startup-enforced transport contracts | Security hardening best practice | Faster failure on insecure prod config, fewer runtime surprises. |

**Deprecated/outdated:**
- Relying on session `MemoryStore` for production-like environments (not production-safe per express-session docs).
- Using `localstack:latest` for deterministic CI/local reproducibility (tag drift risk).

## Open Questions

1. **Which exact one-command entrypoint should be canonical (`npm`, `make`, or script)?**
   - What we know: It is intentionally discretionary.
   - What's unclear: Team preference for cross-platform ergonomics and CI reuse.
   - Recommendation: Use `npm run dev:saas-local` as canonical; optionally alias `make` later.

2. **Should Phase 1 use Prisma migrations or `db push` for local bootstrap?**
   - What we know: No migration history is currently committed.
   - What's unclear: Whether this phase wants strict migration continuity now or temporary prototyping flow.
   - Recommendation: For COMP continuity, prefer committed migrations + `migrate deploy`; if deferred, document `db push` as explicitly local-only.

## Sources

### Primary (HIGH confidence)
- Docker Compose merge behavior: https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/
- Docker Compose profiles: https://docs.docker.com/compose/how-tos/profiles/
- Docker Compose `depends_on`/health behavior: https://docs.docker.com/reference/compose-file/services/#depends_on
- Docker Compose interpolation: https://docs.docker.com/reference/compose-file/interpolation/
- Docker Compose `up` / `config` commands: https://docs.docker.com/reference/cli/docker/compose/up/ and https://docs.docker.com/reference/cli/docker/compose/config/
- Node URL API (WHATWG URL): https://nodejs.org/docs/latest-v24.x/api/url.html
- Next.js env variable behavior: https://nextjs.org/docs/app/guides/environment-variables
- Express proxy guidance: https://expressjs.com/en/guide/behind-proxies.html
- Prisma migrate workflow: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production

### Secondary (MEDIUM confidence)
- MDN WebSocket constructor behavior (`https` resolves to secure WebSocket): https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
- MDN mixed content blocking model: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content
- `express-session` package guidance (MemoryStore and secure cookies): https://www.npmjs.com/package/express-session

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - based on repository lock-in + official docs.
- Architecture: HIGH - directly derived from current repo layout and Compose/Express/Next behavior.
- Pitfalls: HIGH - observed in current code paths (agent token requirement, insecure defaults, missing migration history) and validated with official docs.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01
