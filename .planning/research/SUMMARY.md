# Project Research Summary

**Project:** Docker Dashboard
**Domain:** Docker Monitoring SaaS with Agent-Based Connectivity
**Researched:** 2026-02-27
**Confidence:** MEDIUM

## Executive Summary

This is a multi-tenant Docker monitoring SaaS that uses lightweight agents installed on customer Docker hosts to collect metrics, logs, and execute container actions. The unique value proposition is the **agent-based outbound WebSocket connectivity** — agents connect outward to the cloud, avoiding the need for customers to open inbound firewall ports. This is fundamentally different from most monitoring tools and creates a simpler deployment story.

The recommended stack uses **Next.js 15** for the cloud UI, **Node.js 22** for the API layer, **PostgreSQL with TimescaleDB** for time-series metrics, and **Go 1.23** for the customer-facing agent. The agent-to-cloud communication uses WebSocket (not gRPC) because it's firewall/NAT friendly and works through corporate proxies. This architecture aligns with industry standards from Datadog and Grafana Cloud, adapted for the outbound-only connectivity model.

The critical risks are: (1) **high cardinality metrics explosion** that can inflate costs 10x, (2) **agent connectivity reliability** in customer environments with restrictive networks, (3) **multi-tenant data isolation** which must be designed in from day one. These should be addressed in Phase 1 core infrastructure.

## Key Findings

### Recommended Stack

**Core technologies:**
- **Next.js 15.x** — Cloud UI with App Router, SSR/ISR for dashboards
- **Node.js 22.x (LTS)** — API runtime, native WebSocket support, same JS/TS across stack
- **PostgreSQL 17.x + TimescaleDB** — Primary DB with native time-series support via hypertables
- **Redis 7.x** — Sessions, caching, pub/sub for WebSocket state management
- **Go 1.23.x** — Agent implementation (small binary, excellent Docker client libraries)
- **Turborepo 2.x** — Monorepo orchestration with caching and incremental builds
- **WebSocket (WSS)** — Agent↔Cloud communication; outbound connections only for firewall traversal

**Key stack decisions:**
- WebSocket over gRPC for agent communication (firewall/proxy friendly)
- TimescaleDB over dedicated TSDB (PostgreSQL extension, simpler ops)
- Prisma ORM for developer experience
- pnpm for package management

### Expected Features

**Must have (table stakes):**
- Real-time container metrics — CPU, memory, network, block I/O via Docker stats API
- Container list/fleet view — all containers across registered hosts
- Container logs (live streaming) — tail logs from selected container
- Container actions — start/stop/restart with confirmation
- Host enrollment — agent installation + registration flow
- User authentication — email/password to cloud dashboard
- Multi-tenant isolation — org/project separation with RLS
- Basic alerts — container down + restart loop detection

**Should have (competitive):**
- Agent-based outbound connectivity — unique differentiator
- Multi-host aggregate view — fleet health across Docker hosts
- Protected containers policy — prevent accidental stops
- Audit logging — track who performed actions
- Alert routing — Slack/webhook integrations

**Defer (v2+):**
- Full log search/indexing — extremely expensive at scale
- Kubernetes support — fundamentally different architecture
- Custom dashboards — scope creep, pre-built sufficient
- Billing/payments — separate concern, add later

### Architecture Approach

The system uses an **agent-initiated outbound connection** model where the customer-installed agent establishes a persistent WebSocket connection to the cloud. This avoids inbound firewall holes. Data flows: Docker stats API → Agent → WebSocket → Cloud API → TimescaleDB (metrics) / PostgreSQL (logs).

**Major components:**
1. **Next.js UI** — User dashboard, authentication, visualization
2. **Node.js API** — REST endpoints, business logic, WebSocket server
3. **PostgreSQL + TimescaleDB** — Tenant data, time-series metrics
4. **Redis** — Session management, pub/sub for action commands
5. **Agent (Go)** — Metrics collection, log streaming, action execution

### Critical Pitfalls

1. **High Cardinality Metrics Explosion** — Metrics cardinality grows exponentially with container labels. Define strict label allowlists, reject dynamic labels like container_id. Phase to address: Phase 1.

2. **Agent Connectivity Reliability** — Agents lose connectivity in restrictive customer networks. Implement heartbeat (30s), exponential backoff with jitter (max 5min), last_seen tracking. Phase to address: Phase 1 + Phase 2.

3. **Multi-Tenant Data Isolation Leakage** — Tenant A sees Tenant B's data. Implement tenant_id from day one, tenant-scoped Redis keys, RLS policies. Phase to address: Phase 1 (MUST be designed in from start).

4. **Docker Daemon Permission Issues** — Agent can't access Docker stats API, or has too much access. Document minimum permissions, provide systemd service, never mount docker.sock in production agent container. Phase to address: Phase 1 + Phase 2.

5. **Ephemeral Container Data Loss** — Missing metrics from short-lived containers. Implement event-based collection alongside polling, use container labels for stable identity. Phase to address: Phase 1.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Infrastructure
**Rationale:** Foundation that everything else depends on. Multi-tenant isolation and agent connectivity must work correctly from the start.
**Delivers:** 
- Database schema with tenant isolation (RLS)
- Shared TypeScript types between agent and cloud
- Basic API server with tenant CRUD
- Agent with Docker stats collection (standalone mode)
- WebSocket server for agent connections

**Addresses:** Multi-tenant isolation, high cardinality prevention, ephemeral container handling, Docker permissions
**Avoids:** Pitfall #5 (data isolation) — must design in from day one

### Phase 2: Agent Deployment & Fleet Management
**Rationale:** Agent must reliably connect to cloud before adding monitoring features. Host enrollment depends on working agent connectivity.
**Delivers:**
- Agent cloud connection with heartbeat/reconnection
- Host enrollment flow
- Fleet view (container list across hosts)
- Basic RBAC (org/project/host levels)
- Agent auto-update mechanism

**Addresses:** Agent connectivity reliability, Docker permissions, RBAC gaps
**Avoids:** Pitfall #2 (connectivity), Pitfall #8 (RBAC)

### Phase 3: Observability & Actions
**Rationale:** Core monitoring features once agent connectivity is stable. Logs and actions add complexity but are expected features.
**Delivers:**
- Real-time container metrics display
- Live log streaming
- Container actions (start/stop/restart)
- Basic alerting (threshold-based)
- Audit logging

**Addresses:** Table stakes features, restart loop detection, audit logging
**Avoids:** Pitfall #6 (alert fatigue) — use conservative defaults

### Phase 4: Alerting & Notifications
**Rationale:** Alerting depends on metrics being collected. Add routing after basic alerts work.
**Delivers:**
- Alert routing (Slack, webhooks, email)
- Protected containers policy
- Simple dashboard with fleet health
- Container resource history (24h retention)

**Addresses:** Alert routing, protected containers, dashboard
**Avoids:** Pitfall #6 (alert fatigue), Pitfall #7 (log costs)

### Phase Ordering Rationale

- Phase 1 before anything else — isolation and agent basics are non-negotiable foundation
- Phase 2 depends on Phase 1 agent types and WebSocket contract
- Phase 3 requires working agent→cloud path (Phase 2) plus DB schema (Phase 1)
- Phase 4 adds alerting which requires metrics from Phase 3
- Feature groupings align with architecture dependencies from ARCHITECTURE.md

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Agent heartbeat protocol specifics — need to define message format, reconnection strategy
- **Phase 2:** RBAC implementation patterns — Docker hierarchy (Org→Project→Host→Container) needs validation
- **Phase 3:** Log streaming architecture — WebSocket scaling, buffering strategies

Phases with standard patterns (skip research-phase):
- **Phase 3:** Container metrics visualization — well-documented patterns
- **Phase 4:** Alert routing integrations — standard webhook patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Industry-standard choices verified against Datadog/Grafana architectures |
| Features | MEDIUM | Table stakes clear; differentiators based on competitive analysis |
| Architecture | MEDIUM | Standard SaaS patterns, agent outbound connectivity is well-documented |
| Pitfalls | MEDIUM | Common observability pitfalls, some Docker-specific gaps |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Agent update mechanism:** Research didn't dive deep into secure OTA updates — needs planning-phase research
- **Self-hosted mode specifics:** Architecture supports it but detailed implementation unclear
- **Log storage strategy:** Deferred but critical — need to decide between Postgres JSONB vs object storage early enough to budget

## Sources

### Primary (HIGH confidence)
- Datadog Agent Architecture (https://docs.datadoghq.com/agent/architecture/) — Industry standard agent pattern
- Docker official runtime metrics documentation
- TimescaleDB documentation — Time-series data at scale

### Secondary (MEDIUM confidence)
- Ably - gRPC vs WebSocket comparison
- Grafana Cloud Docker monitoring with Alloy
- Portainer container management features
- Turborepo Next.js monorepo guidance
- OpenTelemetry Collector documentation

### Tertiary (LOW confidence)
- Community comparisons (Middleware.io, Better Stack) — need validation during implementation

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
