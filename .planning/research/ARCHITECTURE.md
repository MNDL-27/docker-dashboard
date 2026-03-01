# Architecture Research

**Domain:** Multi-tenant Docker control plane with outbound-only host agents
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                          Experience + Identity Layer                      │
├────────────────────────────────────────────────────────────────────────────┤
│  Cloud Web UI  │  AuthN/AuthZ  │  RBAC Guard  │  Audit Viewer            │
└────────┬───────────────┬───────────────┬───────────────────────┬──────────┘
         │               │               │                       │
┌────────▼───────────────▼───────────────▼───────────────────────▼──────────┐
│                             Control Plane API                               │
├────────────────────────────────────────────────────────────────────────────┤
│ Enrollment API │ Fleet/Inventory API │ Action API │ Telemetry Ingest API   │
│ Alert API      │ Query API            │ Stream Hub │ Compatibility Adapter  │
└────────┬───────────────────┬───────────────────┬───────────────────┬───────┘
         │                   │                   │                   │
┌────────▼──────────┐ ┌──────▼────────────┐ ┌────▼───────────────┐ ┌────────▼───────┐
│ Metadata Store    │ │ Command/Event Bus │ │ Time/Log Pipeline  │ │ Object Storage │
│ (Postgres + RLS)  │ │ (Redis or NATS)   │ │ (append + rollup)  │ │ (log exports)  │
└────────┬──────────┘ └──────┬────────────┘ └────┬───────────────┘ └────────┬───────┘
         │                   │                   │                            │
┌────────▼───────────────────▼───────────────────▼────────────────────────────▼───────┐
│                               Host Agent Runtime                                      │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ Enrollment Client │ Heartbeat Loop │ Inventory Snapshotter │ Metrics/Logs/Event tail │
│ Action Executor   │ Local Policy Guard │ Delivery/Ack/Retry │ Local Spool (disk)      │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Cloud Web | Tenant-scoped UX, action initiation, live views | SPA + SSE/WebSocket stream client |
| Identity + RBAC | User auth, org/project roles, permission checks | OIDC + centralized policy checks in API |
| Control Plane API | Single policy enforcement point and orchestration | TypeScript service with modular domains |
| Enrollment Service | Bootstrap trust and issue long-lived agent identity | One-time enrollment token -> signed agent credential |
| Agent Connectivity Service | Maintain outbound session state, route control messages | Long-polling or bidirectional stream gateway |
| Action Orchestrator | Persist intent, dispatch command, track ack/result | Durable command table + queue + idempotency keys |
| Telemetry Ingest | Validate, normalize, rate-limit, route metrics/logs/events | Ingest workers + bounded retention tiers |
| Metadata Store | Source of truth for org/project/host/container/audit | Postgres with Row-Level Security (RLS) |
| Hot Path Cache/Bus | Fan-out live updates, command wakeups, transient coordination | Redis Streams/PubSub or NATS subjects |
| Host Agent | Outbound comms, local collection, safe execution | Daemon with pluggable collectors/executors |

## Recommended Project Structure

```text
apps/
├── cloud-web/                   # SaaS UI
├── cloud-api/                   # Control plane APIs + stream hub
├── agent/                       # Host daemon
└── selfhosted/                  # Existing mode (kept functional)

packages/
├── domain/                      # Shared entities (org, project, host, action)
├── contracts/                   # API and agent protocol schemas (versioned)
├── authz/                       # RBAC policy engine + permission helpers
├── telemetry/                   # Metric/log/event envelope + validation
├── data-access/                 # Postgres repos, RLS-safe query helpers
├── queue/                       # Command bus adapter (Redis/NATS abstraction)
└── compatibility/               # Adapters preserving self-hosted behavior
```

### Structure Rationale

- **`apps/cloud-api` as policy choke point:** every tenant read/write and every action flows through one enforceable boundary.
- **`packages/contracts` first:** agent/cloud protocol versioning prevents lockstep deploy risk.
- **`packages/compatibility` explicit:** self-hosted mode remains a supported runtime path, not accidental legacy code.

## Architectural Patterns

### Pattern 1: Control Plane/Data Plane Split

**What:** Keep SaaS control plane stateless about host execution; host agent is the execution data plane.
**When to use:** Outbound-only customer networks and many heterogeneous hosts.
**Trade-offs:** More protocol work up front, but safer tenant isolation and cleaner scaling boundaries.

**Example:**
```typescript
// control plane persists intent, never executes Docker directly
await actions.create({
  tenantId,
  hostId,
  command: "container.restart",
  correlationId,
  status: "queued"
});
await commandBus.publish(`agent.${hostId}.commands`, { correlationId });
```

### Pattern 2: Durable Intent + Async Delivery (Outbox style)

**What:** Write command intent to Postgres first, then deliver through queue/stream; agent reports state transitions.
**When to use:** Any action that must survive restarts and provide audit history.
**Trade-offs:** Slightly more latency and complexity; major gain in reliability and traceability.

**Example:**
```typescript
// same transaction: command row + outbox row
await tx.insert("action_commands", command);
await tx.insert("outbox", {
  topic: "agent.command.dispatch",
  key: command.id,
  payload: { commandId: command.id, hostId: command.hostId }
});
```

### Pattern 3: Tenant Isolation in Depth

**What:** Enforce tenant boundary in token claims, service layer, and database RLS.
**When to use:** Multi-tenant SaaS where any cross-tenant leak is a severity-1 incident.
**Trade-offs:** More plumbing in every query path; drastically reduced blast radius.

## Data Flow

### Control and Telemetry Flow

```text
Enrollment
Agent -> Enrollment API (one-time token) -> Credential issuance -> Agent stores long-lived credential

Heartbeat + Inventory
Agent -> Connectivity/Heartbeat API -> Presence state + host/container snapshots in Postgres

Telemetry
Agent -> Telemetry Ingest -> validation/rate limits -> hot stream cache -> retained store/rollups

Actions
User -> Cloud Web -> Action API (RBAC + policy checks) -> durable command record
      -> queue/stream -> Agent pull/stream receive -> local execute -> result/ack -> audit log

Live UI
Postgres + hot stream cache -> Stream Hub -> browser SSE/WebSocket channels
```

### Control Points (must be explicit)

1. **Enrollment gate:** short-lived bootstrap token, one-time use, rotation on completion.
2. **Authorization gate:** every action resolved against org/project role + resource ownership.
3. **Policy gate at agent:** reject unsafe local requests (unknown container, stale command, mismatched tenant/host).
4. **Rate/retention gate:** per-tenant ingest budgets and hard telemetry TTLs.
5. **Audit gate:** immutable action/event trail for request -> dispatch -> execution outcome.

## Suggested Build Order (Dependency-Driven)

1. **Identity, tenancy, and RLS foundation**
   - Needed before any endpoint can safely read/write tenant data.
2. **Enrollment + connectivity skeleton**
   - Establishes outbound trust channel and online/offline host model.
3. **Inventory + heartbeat persistence**
   - Creates stable fleet model and host/container graph.
4. **Action pipeline (durable command + ack lifecycle + audit)**
   - Depends on connectivity and tenancy; unlocks core control-plane value.
5. **Telemetry ingest + live stream fan-out + bounded retention**
   - Depends on host identity and stream infrastructure.
6. **Alerting and notification layer**
   - Depends on telemetry and action state quality.
7. **Compatibility hardening for self-hosted mode**
   - Continuous from phase 1, but full parity validation after core cloud loops are stable.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k hosts | Single control-plane service + Postgres primary + optional Redis for fan-out |
| 1k-25k hosts | Split ingest and action workers, introduce queue partitions by host/tenant |
| 25k+ hosts | Dedicated stream gateway tier, sharded telemetry storage, regional control-plane edges |

### Scaling Priorities

1. **First bottleneck:** telemetry ingest fan-in and stream fan-out; solve with queue buffering + stream hubs.
2. **Second bottleneck:** noisy-tenant impact on shared DB; solve with strict per-tenant quotas and storage partitioning.

## Anti-Patterns

### Anti-Pattern 1: API Directly Talking to Docker on Customer Hosts

**What people do:** Try to execute host actions from cloud API directly.
**Why it's wrong:** Breaks outbound-only constraint, creates major security and NAT/firewall complexity.
**Do this instead:** Route all execution through authenticated outbound agent sessions.

### Anti-Pattern 2: Best-Effort Commands Without Durable State

**What people do:** Emit action messages over ephemeral pub/sub and hope agent is connected.
**Why it's wrong:** Lost commands, no auditability, impossible user trust.
**Do this instead:** Persist command intent and state transitions before delivery attempts.

### Anti-Pattern 3: Tenant Isolation Only in Application Code

**What people do:** Depend on ad-hoc WHERE clauses and developer discipline.
**Why it's wrong:** One missed filter causes cross-tenant data exposure.
**Do this instead:** Enforce RLS + scoped DB sessions + service-layer authorization checks.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OIDC provider | Browser + API token validation | Prefer org/project claims mapped to internal roles |
| Email/Webhook provider | Async notification worker | Never block alert evaluation on delivery latency |
| Object storage | Export/archive logs and artifacts | Keep hot logs bounded in primary store |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Cloud Web <-> Cloud API | HTTPS + SSE/WebSocket | Streaming path must be tenant-scoped and revocable |
| Cloud API <-> Agent Gateway | mTLS or signed token over outbound channel | Correlation IDs mandatory for command lifecycle |
| Control Plane <-> Data Stores | Repository layer with tenant context | No raw SQL bypass in feature code |

## Sources

- PostgreSQL Row-Level Security docs (official): https://www.postgresql.org/docs/current/ddl-rowsecurity.html (HIGH)
- OpenTelemetry Collector architecture (agent and gateway patterns): https://opentelemetry.io/docs/collector/architecture/ (HIGH)
- Azure Arc connected machine agent networking (outbound over 443): https://learn.microsoft.com/en-us/azure/azure-arc/servers/network-requirements (HIGH)
- AWS SSM Agent technical details (hybrid registration, credential behavior, heartbeat/hibernation behavior): https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent-technical-details.html (MEDIUM-HIGH)
- Cloudflare Tunnel outbound-only connector model: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/ (HIGH)
- NATS JetStream durability/ack/replay semantics: https://docs.nats.io/nats-concepts/jetstream (MEDIUM)
- NATS request-reply pattern: https://docs.nats.io/nats-concepts/core-nats/reqreply (MEDIUM)
- gRPC streaming lifecycle (server/client/bidirectional streams): https://grpc.io/docs/what-is-grpc/core-concepts/ (MEDIUM)
- Socket.IO multi-node Redis adapter behavior and sticky-session caveat: https://socket.io/docs/v4/redis-adapter/ (MEDIUM)

---
*Architecture research for: Docker Dashboard Cloud*
*Researched: 2026-03-01*
