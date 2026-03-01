# Project Research Summary

**Project:** Docker Dashboard Cloud
**Domain:** Multi-tenant Docker fleet observability and control SaaS (cloud control plane + outbound-only host agents)
**Researched:** 2026-03-01
**Confidence:** MEDIUM

## Executive Summary

Docker Dashboard Cloud should be built as a security-first control plane for Docker fleets, not as a generic observability clone and not as a remote shell product. The research converges on an outbound-only agent architecture with a strict control-plane/data-plane split: cloud services persist intent, enforce policy, and stream state; host agents execute only a constrained action catalog and report results. This aligns with how mature platforms handle remote environments while preserving the project's key advantage over inbound API models.

The recommended approach is a TypeScript monorepo on Node.js with Next.js for cloud UX, Fastify for high-throughput APIs, Postgres for tenancy/action metadata, and ClickHouse for telemetry retention/query workloads. NATS JetStream (or equivalent durable bus) and Redis support reliable command delivery and hot-path coordination. OpenFGA-style centralized authorization is strongly preferred to avoid role-check sprawl as org/project/host relationships grow. MVP scope should remain Docker-first and centered on secure enrollment, inventory, live metrics/logs, safe container lifecycle actions, RBAC, and auditability.

The highest risks are predictable and avoidable: cross-tenant leakage, RBAC drift between request and execution paths, weak enrollment/token lifecycle, unsafe action surface growth, and telemetry cost/cardinality blowups. Mitigation is to front-load tenancy/RLS/authz invariants, implement durable intent + execute-time policy re-checks, enforce one-time enrollment + credential rotation, and ship bounded retention/schema budgets before feature expansion. Roadmap success depends more on sequencing and guardrails than on adding broad feature surface early.

## Key Findings

### Recommended Stack

The stack recommendation is coherent and dependency-aware for this domain: preserve Node/TypeScript monorepo velocity while splitting OLTP metadata from observability data. The most important architectural choice is Postgres for transactional control-plane records plus ClickHouse for telemetry, with explicit retention controls and quotas from day one.

**Core technologies:**
- `Node.js 24 LTS` + `TypeScript 5.9` - shared contracts across cloud API, agent, and web app reduce protocol drift.
- `Next.js 16` - mature SaaS web layer with SSR/App Router and operational tooling.
- `Fastify 5` - lower overhead API runtime for ingest/heartbeat/action hot paths.
- `PostgreSQL 18` - system of record for tenants, RBAC context, inventory, action and audit metadata.
- `ClickHouse 25.8 LTS` - high-ingest telemetry analytics with practical TTL retention control.
- `NATS JetStream 2.12` + `Redis 8.6` - durable async command/event delivery and fast coordination/cache primitives.
- `OpenTelemetry Collector 0.146` - vendor-neutral ingest/processing pipeline.
- `OpenFGA 1.11` - centralized fine-grained authz model that scales past ad-hoc RBAC checks.

Critical version notes: keep `next@16.1.6` aligned with `react@19.2.x`, keep Fastify and websocket plugin majors aligned, and treat telemetry backend/storage versions as operationally validated per phase.

### Expected Features

MVP must validate the core operator loop: securely connect hosts, see fleet state, inspect metrics/logs, take safe actions, and trust who did what. Research strongly supports avoiding broad platform parity in v1 (Kubernetes, deep Docker object management, full-text indexing).

**Must have (table stakes):**
- Secure enrollment + durable outbound heartbeat/session model.
- Multi-tenant boundaries + RBAC + immutable audit trail.
- Fleet inventory and container drill-down with health/freshness states.
- Live metrics with short history, live logs with basic filtering + download.
- Safe lifecycle actions (`start/stop/restart`) with action status tracking.
- Basic alerting + notification routing (email/webhook) with initial noise controls.

**Should have (competitive):**
- Bandwidth-aware async mode for constrained/remote sites.
- Correlated incident timeline across actions, logs, metrics, and alerts.
- Guardrailed action policies (scope/blast-radius, then approvals).
- Opinionated Docker health packs and cost-aware telemetry controls.
- Seamless dual-mode continuity for current self-hosted users.

**Defer (v2+):**
- Full-text log indexing tiers.
- Expanded Docker object management (images/volumes/networks).
- Kubernetes support.

### Architecture Approach

Architecture should enforce one policy choke point (`cloud-api`) and treat protocol/contracts as first-class artifacts. Durable command intent, explicit tenant context, and agent-side safety checks are required invariants, not enhancements.

**Major components:**
1. **Cloud Web + Stream Client** - tenant-scoped UX for inventory, telemetry, action initiation, and live updates.
2. **Identity/AuthZ Layer** - OIDC authn + centralized authorization checks for every read/action path.
3. **Control Plane API** - enrollment, fleet, action, telemetry ingest/query, and stream hub orchestration.
4. **Action Orchestrator + Bus** - persist intent, dispatch asynchronously, capture ack/result lifecycle idempotently.
5. **Telemetry Ingest Pipeline** - validation, rate limits, schema/cardinality enforcement, retention routing.
6. **Metadata + Telemetry Stores** - Postgres (RLS-backed metadata/audit) and ClickHouse (metrics/logs retention).
7. **Host Agent Runtime** - outbound connectivity, inventory snapshotting, local collection, allowlisted action execution.
8. **Compatibility Adapters** - preserve self-hosted behavior while cloud architecture evolves.

### Critical Pitfalls

1. **Tenant isolation only in app code** - enforce tenant context in schema, service, workers, and DB RLS; continuously test cross-tenant denial paths.
2. **RBAC drift across transports and async workers** - centralize policy engine and require execute-time authz re-check with immutable actor context.
3. **Weak enrollment and long-lived credentials** - one-time short TTL bootstrap, renewable bound credentials, rotation and revocation workflows.
4. **Unsafe Docker control surface** - forbid raw daemon/socket passthrough; keep MVP to strict allowlisted lifecycle actions.
5. **Telemetry cardinality/retention runaway** - schema budgets, per-tenant quotas, bounded TTL, and cost alarms before feature growth.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 0: Migration Guardrails (parallel/ongoing)
**Rationale:** Existing self-hosted continuity is a strategic constraint; regressions here create adoption and trust risk early.
**Delivers:** Mode boundaries, compatibility adapters, dual-mode CI lane, parity scorecard.
**Addresses:** Dual-mode continuity differentiator.
**Avoids:** Self-hosted breakage pitfall during cloud-first refactors.

### Phase 1: Security Foundation (Identity, Tenancy, AuthZ)
**Rationale:** Every later feature depends on hard tenant and permission invariants.
**Delivers:** Org/project/user model, role matrix, centralized authz checks, Postgres RLS scaffolding, audit schema baseline.
**Addresses:** RBAC table stakes, tenancy boundaries.
**Avoids:** Cross-tenant leakage and read/action authorization drift.

### Phase 2: Agent Trust + Fleet Presence
**Rationale:** Enrollment and heartbeat quality are prerequisites for trustworthy inventory, telemetry, and actions.
**Delivers:** One-time enrollment flow, credential lifecycle, outbound connectivity/session model, heartbeat and host/container inventory persistence.
**Addresses:** Secure enrollment, fleet inventory, host health visibility.
**Avoids:** Rogue enrollment, stale/fake fleet state, token replay issues.

### Phase 3: Safe Action Control Plane
**Rationale:** Core product value is safe remote control; this should ship before advanced analytics breadth.
**Delivers:** Durable command intent/outbox, async dispatch/ack state machine, allowlisted `start/stop/restart`, immutable action audit timeline.
**Addresses:** Container lifecycle control + governance expectations.
**Avoids:** Best-effort command loss, unsafe command surface, weak non-repudiation.

### Phase 4: Telemetry Core (Metrics/Logs + Retention Controls)
**Rationale:** Observability is essential but can bankrupt MVP without enforced budgets.
**Delivers:** Live metrics + short history, live logs + download/filter, ingest validation/rate limiting, cardinality budgets, tenant quotas, retention enforcement.
**Addresses:** Core observability loop and bounded-cost MVP.
**Avoids:** Cardinality explosion, silent data loss, unbounded retention cost.

### Phase 5: Alerting and Operational Signal Quality
**Rationale:** Alerting only works once telemetry/action state is reliable.
**Delivers:** Baseline resource/uptime alerts, routing and dedup/grouping/inhibition controls, runbook metadata, alert quality SLOs.
**Addresses:** Proactive operations baseline.
**Avoids:** Alert floods and low-actionability pager noise.

### Phase 6: Post-Launch Differentiators
**Rationale:** Add complexity only after MVP reliability and adoption signals.
**Delivers:** Async bandwidth mode tuning, incident timeline correlation, health packs, advanced guardrails/approvals, selective indexing tiers.
**Addresses:** Competitive differentiation and enterprise depth.
**Avoids:** Premature scope expansion and anti-feature drag.

### Phase Ordering Rationale

- Security and tenancy invariants come before all user-facing breadth because failure here is existential.
- Enrollment/connectivity precedes inventory/actions/telemetry because all depend on trusted host identity and session health.
- Action safety ships before advanced observability features to validate the core control-plane value proposition.
- Telemetry includes retention/cost controls in the same phase to prevent predictable budget and reliability failures.
- Alerting follows telemetry stabilization to avoid institutionalizing noisy, low-trust incident workflows.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Agent transport protocol choice (long-poll vs WS vs gRPC streaming), credential binding details, and reconnect semantics under hostile networks.
- **Phase 4:** ClickHouse schema/partitioning and retention economics at expected host/container cardinality; collector buffering/WAL tuning.
- **Phase 6:** Approval workflow UX/policy complexity and selective log indexing unit economics.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Tenancy/RBAC/RLS baseline patterns are well-documented and should move straight to implementation.
- **Phase 3 (MVP action scope):** Durable intent + allowlisted lifecycle actions follow established control-plane patterns.
- **Phase 5 (baseline):** Initial threshold/routing alerting is standard once telemetry quality gates are in place.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong official-source coverage, concrete versioning, and good fit with existing Node/monorepo constraints. |
| Features | MEDIUM | Table stakes are strongly evidenced; differentiator ordering is partially strategic synthesis. |
| Architecture | MEDIUM | Patterns are well established for outbound-agent control planes; protocol and scaling cutovers still need phase validation. |
| Pitfalls | HIGH | Risks and mitigations are backed by authoritative security/observability guidance and map directly to this domain. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Scale assumptions:** Host/container cardinality and ingest rates are not yet quantified; run sizing exercises before finalizing Phase 4 capacity plans.
- **AuthZ model depth:** OpenFGA adoption and policy model complexity need a small proof-of-concept in Phase 1 to prevent late rework.
- **Transport decision:** Final agent channel protocol and fallback behavior need concrete failure-mode testing in Phase 2.
- **Cost model:** Retention tiers, sampling defaults, and notification volume budgets need explicit pricing/FinOps inputs.
- **Compliance posture:** Data residency, audit retention obligations, and customer export requirements need product/legal confirmation.

## Sources

### Primary (HIGH confidence)
- Node.js, Next.js, PostgreSQL, Docker Compose, OpenTelemetry Collector official docs - stack/version and deployment baselines.
- Portainer, Datadog, and New Relic official docs - expected feature baseline for enrollment, inventory, metrics/logs, alerting, RBAC/audit.
- Docker Engine security docs, OWASP authorization guidance, PostgreSQL RLS docs - core security and isolation controls.
- Prometheus + Alertmanager + OpenTelemetry guidance - telemetry cardinality, reliability, and alert quality controls.

### Secondary (MEDIUM confidence)
- NATS JetStream docs and related messaging patterns - durability/replay model fit for command delivery.
- Cloud connector/agent references (Azure Arc, Cloudflare Tunnel, AWS SSM) - outbound agent architecture precedent.
- Loki multi-tenancy/cardinality/retention docs - useful analogs for telemetry operational pitfalls.

### Tertiary (LOW confidence)
- None used for primary recommendations; strategic prioritization choices (especially differentiator sequencing) remain product-opinionated and should be validated with early design partners.

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
