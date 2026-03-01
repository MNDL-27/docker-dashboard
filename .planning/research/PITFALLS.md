# Pitfalls Research

**Domain:** Multi-tenant Docker fleet observability and control SaaS (cloud control plane + outbound host agent)
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Tenant isolation enforced in UI, not in data and query paths

**What goes wrong:**
Teams scope tenants in frontend routes and some API handlers, but miss enforcement in background jobs, exports, search endpoints, and joins. One weak path leaks another tenant's host, logs, or action history.

**Why it happens:**
Isolation is treated as a convenience filter instead of a hard security invariant. Teams rely on app-layer checks only and do not combine DB-level controls with query guardrails.

**How to avoid:**
- Make `tenant_id` mandatory on every persisted control-plane record and telemetry index row.
- Enforce server-side authz on every request and every async consumer.
- Add DB-level isolation guardrails (for example, Postgres RLS where feasible) and fail closed if tenant context is missing.
- Add integration tests that attempt cross-tenant reads/writes from every API domain (inventory, logs, metrics, actions, alerts, audit).

**Warning signs:**
- Queries without `tenant_id` predicates appear in logs.
- Support requests mention "seeing unknown host/container names".
- Data export jobs require manual tenant filters in code.

**Detection approach:**
- Continuous query linting for missing tenant predicates.
- Synthetic cross-tenant security tests in CI and nightly prod-like runs.
- Audit event detector for "actor tenant != target tenant" attempts.

**Phase to address:**
Phase: Identity/Tenancy foundation and data model.

---

### Pitfall 2: RBAC drift between read and action paths

**What goes wrong:**
Users can view only what they should, but still trigger privileged actions (restart/stop) via overlooked endpoints, websocket channels, retries, or batch APIs.

**Why it happens:**
Authorization is fragmented by transport (REST vs socket vs worker). Teams check role in controllers but not in command execution pipelines.

**How to avoid:**
- Centralize authorization policy evaluation in one service used by API, websocket, scheduler, and worker code.
- Define explicit action scopes (for example: `container.read`, `container.action.restart`) rather than coarse roles only.
- Require policy checks both at request admission and right before execution.

**Warning signs:**
- Role matrix exists in docs but not as executable policy.
- Action workers accept commands without actor context.
- "Viewer" role can invoke any non-UI API if called directly.

**Detection approach:**
- Contract tests for each role against each endpoint and command type.
- Audit-log diffing: compare authorized policy result vs actually executed action.
- Static checks preventing direct command execution without policy call.

**Phase to address:**
Phase: AuthN/AuthZ + action API design.

---

### Pitfall 3: Weak host enrollment and long-lived bearer secrets

**What goes wrong:**
Enrollment tokens are reusable/long-lived, agent credentials are not rotated, and stolen tokens allow rogue hosts to enroll and exfiltrate telemetry or execute actions.

**Why it happens:**
Enrollment is optimized for fast demos: one static token, no one-time semantics, weak binding between issued credentials and host identity.

**How to avoid:**
- Use short-lived, one-time enrollment tokens with strict TTL and explicit consumption state.
- Exchange enrollment token for renewable mTLS credentials bound to agent identity and tenant/project.
- Rotate agent credentials automatically and revoke on host decommission or compromise.
- Bind enrollment to expected ownership claims (org/project + optional host attestation signals).

**Warning signs:**
- Same enrollment token used by multiple hosts.
- Agent certificates/keys older than planned rotation window.
- No revocation path in incident response runbook.

**Detection approach:**
- Enrollment anomaly detection (token reuse, geo/IP outliers, burst enrollments).
- Credential age dashboard and SLO alarms on overdue rotation.
- Periodic red-team replay tests of previously used enrollment artifacts.

**Phase to address:**
Phase: Secure enrollment and agent identity lifecycle.

---

### Pitfall 4: Docker control surface treated as low risk

**What goes wrong:**
The system exposes unsafe daemon control paths (direct socket forwarding, over-broad agent commands). A compromised control plane account becomes root-equivalent on customer hosts.

**Why it happens:**
Teams underestimate Docker daemon privilege boundaries and focus on feature breadth over command allowlisting and blast-radius controls.

**How to avoid:**
- Never proxy raw Docker socket access through cloud APIs.
- Implement strict command allowlists for MVP (`start/stop/restart` only) with validated parameters.
- Add host-side action policy checks and optional manual approval for destructive operations.
- Require full actor attribution and immutable audit trail for every attempted and executed action.

**Warning signs:**
- Generic "run docker command" endpoint exists.
- Agent accepts arbitrary Docker API paths.
- Missing action reason / ticket reference in audit entries.

**Detection approach:**
- Security tests attempting arbitrary Docker API invocation through agent.
- Audit analytics for unusual action burst patterns and sensitive target containers.
- Pre-deploy policy tests verifying forbidden action classes remain blocked.

**Phase to address:**
Phase: Safe action orchestration and auditability.

---

### Pitfall 5: Telemetry cardinality explosion (metrics + logs labels)

**What goes wrong:**
Per-container/per-request dynamic labels (container IDs, trace IDs, user IDs) create unbounded streams and timeseries, causing cost spikes and ingestion/query degradation.

**Why it happens:**
Teams map every field to labels/tags for convenience, then discover backend scale limits later.

**How to avoid:**
- Define and enforce telemetry schema budgets per signal (`max labels`, allowed keys, bounded value sets).
- Reject or downsample high-cardinality dimensions at agent/collector.
- Store high-cardinality fields as structured metadata/log body, not index labels.
- Add per-tenant ingestion quotas and backpressure behavior.

**Warning signs:**
- Rapid growth in series/stream count per tenant.
- Increasing queue sizes and exporter failures in collectors.
- Query latency regresses after onboarding noisy tenants.

**Detection approach:**
- Cardinality dashboards with per-tenant outlier alerts.
- Automated policy checks on instrumentation changes (new label keys).
- Collector health alerts on queue capacity and refused telemetry metrics.

**Phase to address:**
Phase: Telemetry schema + ingestion pipeline design.

---

### Pitfall 6: No bounded retention and lifecycle enforcement

**What goes wrong:**
Logs and metrics are ingested continuously but retention/deletion is not actually enforced end-to-end, leading to runaway storage cost and compliance risk.

**Why it happens:**
Retention is specified at product level but not wired into compaction, object-store lifecycle, query lookback limits, and per-tenant overrides.

**How to avoid:**
- Implement retention policy as code with global and per-tenant defaults.
- Verify backend prerequisites (for example, index period constraints and compactor settings where required).
- Couple retention with query lookback caps and export/download rules.
- Add monthly cost guardrails and hard budget alarms.

**Warning signs:**
- Storage growth is monotonic despite retention settings.
- Deleted data remains queryable.
- FinOps surprises after large tenant onboarding.

**Detection approach:**
- Retention conformance jobs that validate "data older than X is inaccessible".
- Storage bucket/object age distribution checks.
- Budget anomaly alerts tied to ingestion and retained bytes.

**Phase to address:**
Phase: Data lifecycle, compliance, and cost controls.

---

### Pitfall 7: Alert storming without grouping/inhibition/dedup

**What goes wrong:**
Every host/container symptom emits separate notifications, resulting in alert floods, pager fatigue, and ignored incidents.

**Why it happens:**
Teams ship "first alert works" but skip routing trees, grouping keys, inhibition rules, and repeat policies.

**How to avoid:**
- Start with symptom-first alerts tied to user impact, not every internal cause.
- Configure grouping (`group_by`), initial wait (`group_wait`), update interval (`group_interval`), and repeat interval intentionally.
- Add inhibition for dependent failures (for example, suppress downstream host alerts when collector outage is active).
- Require runbook links and owner metadata in all production alerts.

**Warning signs:**
- High alert volume with low action rate.
- Many duplicate notifications for same incident window.
- On-call repeatedly silences broad rules.

**Detection approach:**
- Alert quality metrics: dedup ratio, acknowledgement time, actionable rate.
- Game-day replay of known incidents to measure notification count.
- CI validation for alert rule linting and route coverage.

**Phase to address:**
Phase: Alerting and incident workflow design.

---

### Pitfall 8: Agent/back-end outage causes silent telemetry loss

**What goes wrong:**
During endpoint outages, queues fill and data drops silently. Teams discover gaps only during incident retros.

**Why it happens:**
Default in-memory queues/retry windows are left unchanged, no WAL/persistent buffering for critical paths, and no SLO on ingestion durability.

**How to avoid:**
- Configure exporter sending queues and retry windows based on expected outage envelope.
- Enable persistent queue storage (WAL) on critical collectors/agents where acceptable.
- Define and monitor data-loss SLOs (drop rate, backfill delay).
- Use message-queue decoupling on critical cross-network hops if reliability requirements justify complexity.

**Warning signs:**
- Exporter queue regularly near capacity.
- `send_failed`/`enqueue_failed` metrics spike during normal operations.
- Gaps in dashboard timelines after backend maintenance.

**Detection approach:**
- Continuous monitoring of collector queue metrics and failure counters.
- Synthetic heartbeat telemetry per host to detect missing windows.
- Chaos tests that deliberately disrupt downstream endpoints.

**Phase to address:**
Phase: Reliability engineering of telemetry transport.

---

### Pitfall 9: JWT/credential validation gaps enable token confusion or replay

**What goes wrong:**
Services accept tokens with wrong audience/issuer/type or weak algorithm handling, allowing cross-context token reuse and privilege abuse.

**Why it happens:**
Teams rely on library defaults, do not pin accepted algorithms, and apply one validation profile to multiple token types (user session, agent auth, enrollment).

**How to avoid:**
- Enforce explicit algorithm allowlists and reject `none` unless explicitly required in constrained contexts.
- Validate `iss`, `aud`, `exp`, `nbf`, token type (`typ`), and mutually exclusive claim profiles per token class.
- Separate signing keys and validation rules for user tokens vs agent/service tokens.
- Add nonce/replay protection where tokens can be intercepted.

**Warning signs:**
- Same JWT accepted by multiple services with different trust assumptions.
- Missing audience validation in code review.
- Long-lived bearer tokens with no revocation strategy.

**Detection approach:**
- Negative auth tests for alg confusion, wrong audience, wrong issuer, expired/replayed tokens.
- Runtime auth telemetry that logs rejection reason categories.
- Dependency scanning for vulnerable JWT libraries and insecure defaults.

**Phase to address:**
Phase: Security hardening for authn/token lifecycle.

---

### Pitfall 10: Self-hosted mode breaks during SaaS migration

**What goes wrong:**
Cloud-first refactors unintentionally break legacy self-hosted runtime paths, creating regressions for existing users and forcing emergency branch forks.

**Why it happens:**
Migration is treated as a one-way rewrite, not an incremental strangler pattern with compatibility seams and contract tests.

**How to avoid:**
- Keep a clear mode boundary (self-hosted vs cloud) behind capability flags/adapters.
- Use contract tests to assert old API behavior where backward compatibility is promised.
- Build transitional architecture explicitly (shared packages with strict interface boundaries, not ad hoc imports).
- Track parity matrix and deprecation policy from day one.

**Warning signs:**
- Frequent "works in cloud, broken in self-hosted" bug class.
- Shared modules import cloud-only dependencies.
- No CI lane running self-hosted acceptance tests.

**Detection approach:**
- Dual-mode CI pipeline: cloud integration + self-hosted regression suites.
- Compatibility scorecard per release (feature parity + known gaps).
- Release canary with legacy scenario replay.

**Phase to address:**
Phase: Monorepo migration and compatibility architecture.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single global "admin" role for MVP | Ships quickly | RBAC rewrite + incident risk from over-privilege | Only in local dev; never in production SaaS |
| Static enrollment token per org | Easy onboarding demos | Token replay, rogue enrollments, poor revocation posture | Never acceptable beyond throwaway prototype |
| Index all log fields as labels | Fast ad hoc querying | Cardinality explosion and storage/query cost spikes | Never for unbounded fields |
| In-memory queue only in collectors | Simple ops | Data loss on restart/outage | Acceptable for non-critical telemetry in early alpha only |
| Hard-coding tenant filters in handlers | Quick feature delivery | Missed paths and cross-tenant leaks | Temporary with explicit removal ticket and security tests |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Docker Engine API | Exposing daemon API broadly or forwarding raw socket semantics | Use restricted agent command surface and mTLS-protected control channel |
| Telemetry backend (Loki/Prom-compatible) | Unbounded labels and no tenant quotas | Enforce schema budgets, tenant limits, and retention from day one |
| Alert transport (email/webhook) | No grouping/inhibition causing duplicate floods | Configure routing tree with `group_by`, inhibition, and repeat policies |
| Identity provider / JWT validation | Accepting tokens without strict `iss`/`aud`/alg checks | Per-token-type validation rules and key separation |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-tenant hot partition in telemetry ingest | High p99 ingest latency for large tenants | Partition by tenant + host/shard key; apply quotas/backpressure | Often at tens of thousands of containers or one noisy tenant |
| Fan-out websocket streams per dashboard tab | API saturation and UI lag during incidents | Server-side aggregation windows + stream multiplexing | Common around hundreds of concurrent viewers |
| N+1 host/container API fetches | Slow fleet pages and DB pressure | Precompute inventory views and batch read models | Noticeable at thousands of hosts |
| Alert evaluation on raw high-cardinality signals | Rule engine CPU spikes and flapping alerts | Use recording/aggregation rules and bounded dimensions | Breaks during bursty incidents |

## Security Mistakes

Domain-specific security issues beyond generic web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating `tenant_id` as optional in internal RPC/events | Cross-tenant data leakage or action execution | Mandatory tenant context schema + fail-closed middleware |
| Allowing action execution without second-stage authz check | Privilege escalation through async path | Re-check policy at execution time with immutable actor context |
| No immutable audit trail for control actions | Non-repudiation failure and weak incident response | Append-only audit log with actor, target, reason, result, request ID |
| Reusable enrollment artifacts | Rogue host enrollment and persistent compromise | One-time short-lived enrollment + cert rotation + revocation |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Ambiguous "host offline" state | Operators cannot tell outage vs connectivity glitch | Distinct states: heartbeat stale, agent disconnected, auth failed |
| No action preview/impact warning | Accidental restart of critical container | Confirm dialog with target metadata, blast radius, and rollback hints |
| Alert feed without dedup or incident threading | On-call overload and missed root cause | Incident-centric timeline grouping related alerts/events |
| Missing tenant/project context in pages | Easy operator mistakes across fleets | Persistent context banner + scoped search and color-coded boundaries |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Tenant isolation:** API/UI filtered but background jobs unscoped - verify synthetic cross-tenant test suite passes.
- [ ] **RBAC:** Read permissions wired but action workers bypass checks - verify execute-time policy checks.
- [ ] **Enrollment:** Host can connect once - verify token one-time use, rotation, and revocation all work.
- [ ] **Telemetry:** Dashboards show live data - verify retention, quotas, and cardinality budgets enforced.
- [ ] **Alerting:** Notifications sent - verify grouping, inhibition, and dedup quality metrics meet targets.
- [ ] **Self-hosted compatibility:** Core flow works locally - verify dedicated regression lane for legacy mode.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-tenant data leakage | HIGH | Freeze affected APIs, rotate credentials, run scoped breach analysis, notify tenants, patch invariant checks, add permanent regression tests |
| Rogue host enrollment | HIGH | Revoke enrollment/agent creds, quarantine host IDs, rotate org trust material if required, replay audit logs for impact |
| Telemetry cost/cardinality blow-up | MEDIUM-HIGH | Enforce emergency label drop policies, cap tenant ingest, backfill dashboards with aggregated signals, reindex if needed |
| Alert storm fatigue | MEDIUM | Introduce temporary global dedup routes, silence low-value rules, add inhibition/grouping, run post-incident rule cleanup |
| Self-hosted regression | MEDIUM | Hotfix compatibility adapter, pin previous release for affected users, restore parity tests before next release |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tenant isolation enforced too late | Phase 1: Identity/tenant data model | Mandatory tenant-context tests pass across API + workers |
| RBAC drift across transports | Phase 2: Unified authz policy engine | Role/action matrix tests pass for REST, socket, and async paths |
| Enrollment replay and weak credentials | Phase 2: Enrollment security | One-time token replay tests fail as expected; rotation SLO green |
| Unsafe Docker control actions | Phase 3: Action safety | Forbidden command tests blocked; all actions audited with actor context |
| Cardinality explosion | Phase 3: Telemetry ingestion architecture | Cardinality budget dashboards and quota enforcement active |
| Unbounded retention/cost | Phase 3: Retention and cost governance | Data older than policy is non-queryable; budget alarms exercised |
| Alert noise and duplicate pages | Phase 4: Alerting/notification quality | Dedup ratio and actionable alert SLOs achieved in game-days |
| Silent data loss during outages | Phase 4: Pipeline resilience | Chaos outage drills show bounded loss and queue recovery |
| Token confusion/replay in auth stack | Phase 2: Auth hardening | Negative JWT validation suite (alg/aud/iss/typ/replay) passes |
| Self-hosted mode regressions | Phase 0-ongoing: migration strategy | Dual-mode CI + release canary pass before ship |

## Sources

- Docker Engine security guidance and daemon access hardening: https://docs.docker.com/engine/security/ (HIGH)
- Docker daemon socket protection (SSH/TLS, key risk): https://docs.docker.com/engine/security/protect-access/ (HIGH)
- OWASP Top 10 A01 Broken Access Control: https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/ (HIGH)
- OWASP Authorization Cheat Sheet (deny by default, per-request checks, ABAC/ReBAC): https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html (HIGH)
- PostgreSQL Row-Level Security docs: https://www.postgresql.org/docs/current/ddl-rowsecurity.html (HIGH)
- Prometheus instrumentation and label-cardinality guidance: https://prometheus.io/docs/practices/instrumentation/ and https://prometheus.io/docs/practices/naming/ (HIGH)
- Prometheus remote write failure/queue behavior: https://prometheus.io/docs/practices/remote_write/ (HIGH)
- Prometheus alerting guidance (symptom-first, noise reduction): https://prometheus.io/docs/practices/alerting/ (HIGH)
- Alertmanager routing/grouping/inhibition controls: https://prometheus.io/docs/alerting/latest/configuration/ (HIGH)
- Grafana Loki multi-tenancy model: https://grafana.com/docs/loki/latest/operations/multi-tenancy/ (HIGH)
- Grafana Loki cardinality guidance: https://grafana.com/docs/loki/latest/get-started/labels/cardinality/ (HIGH)
- Grafana Loki retention/compactor behavior: https://grafana.com/docs/loki/latest/operations/storage/retention/ (HIGH)
- OpenTelemetry metrics cardinality/memory guidance: https://opentelemetry.io/docs/specs/otel/metrics/supplementary-guidelines/ (HIGH)
- OpenTelemetry Collector scaling and resiliency (queues/WAL/loss modes): https://opentelemetry.io/docs/collector/scaling/ and https://opentelemetry.io/docs/collector/resiliency/ (HIGH)
- JWT spec and security BCP (algorithm validation, audience/issuer/type): https://www.rfc-editor.org/rfc/rfc7519 and https://www.rfc-editor.org/rfc/rfc8725 (HIGH)
- Strangler Fig incremental modernization pattern (for preserving legacy mode): https://martinfowler.com/bliki/StranglerFigApplication.html (MEDIUM)

---
*Pitfalls research for: Docker Dashboard Cloud*
*Researched: 2026-03-01*
