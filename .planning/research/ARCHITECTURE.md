# Architecture Research

**Domain:** Docker Monitoring SaaS
**Researched:** 2026-02-27
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD CONTROL PLANE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │  Next.js    │   │   Node/TS   │   │  PostgreSQL │   │    Redis    │   │
│  │     UI      │◄──│     API      │◄──│      DB     │   │  (sessions/ │   │
│  │             │   │             │   │             │   │   caching)   │   │
│  └─────────────┘   └──────┬──────┘   └─────────────┘   └─────────────┘   │
│                           │                                                  │
│                    ┌──────┴──────┐                                          │
│                    │  WebSocket  │                                          │
│                    │   Server     │                                          │
│                    └──────┬──────┘                                          │
├───────────────────────────┼────────────────────────────────────────────────┤
│                     AGENT GATEWAY                                           │
│                    (TLS termination,                                       │
│                     auth, rate limiting)                                    │
├───────────────────────────┼────────────────────────────────────────────────┤
│                     PUBLIC INTERNET                                          │
└───────────────────────────┼────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼───────┐ ┌────▼────┐ ┌───────▼───────┐
    │   AGENT       │ │  AGENT   │ │    AGENT       │
    │   (Host 1)    │ │ (Host 2) │ │    (Host N)    │
    │                │ │          │ │                │
    │ ┌──────────┐  │ │┌───────┐ │ │ ┌──────────┐  │
    │ │Collector │  │ ││Collec-│ │ │ │Collector │  │
    │ │(metrics, │  │ ││tor    │ │ │ │(metrics, │  │
    │ │ logs)    │  │ │└───────┘ │ │ │ logs)    │  │
    │ └──────────┘  │ │          │ │ └──────────┘  │
    │ ┌──────────┐  │ │          │ │ ┌──────────┐  │
    │ │Docker API│  │ │          │ │ │Docker API│  │
    │ │Client    │  │ │          │ │ │Client    │  │
    │ └──────────┘  │ │          │ │ └──────────┘  │
    └────────────────┘ └──────────┘ └────────────────┘
            CUSTOMER DOCKER INFRASTRUCTURE
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|----------------------|
| **Next.js UI** | User-facing dashboard, authentication, visualization | Next.js 14+ with App Router, React Query for data fetching |
| **Node/TS API** | REST/GraphQL API for CRUD operations, business logic | Express/Fastify or Next.js API routes, tRPC optional |
| **PostgreSQL DB** | Persistent storage for tenants, users, hosts, metrics metadata | Primary data store, TimescaleDB extension for time-series |
| **Redis** | Session management, real-time caching, pub/sub for WebSocket | Session store, rate limiting, message bus |
| **WebSocket Server** | Real-time agent connections, push-based telemetry | ws library or Socket.io, per-tenant channels |
| **Agent Gateway** | TLS termination, authentication, connection management | Reverse proxy (nginx/Caddy) or dedicated service |
| **Agent** | Container metrics collection, log streaming, action execution | Lightweight Go/Rust binary or sidecar container |

## Recommended Project Structure

```
docker-dashboard/
├── apps/
│   ├── web/                    # Next.js UI application
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── lib/           # Utilities, API clients
│   │   │   └── hooks/         # Custom React hooks
│   │   └── package.json
│   ├── api/                    # Node.js API server
│   │   ├── src/
│   │   │   ├── routes/        # API endpoint handlers
│   │   │   ├── services/      # Business logic
│   │   │   ├── middleware/    # Auth, validation, rate limiting
│   │   │   ├── db/            # Prisma migrations, queries
│   │   │   └── websocket/     # WebSocket server logic
│   │   └── package.json
│   └── agent/                  # Customer-installed agent
│       ├── cmd/               # Entry points
│       ├── internal/
│       │   ├── collector/    # Metrics/logs collection
│       │   ├── client/       # Docker API client
│       │   └── transport/     # WebSocket client
│       └── package.json
├── packages/
│   ├── database/              # Shared Prisma client, schemas
│   ├── config/                # Shared configuration
│   ├── types/                 # Shared TypeScript types
│   └── ui/                    # Shared UI components (optional)
└── turbo.json                  # Monorepo orchestration
```

### Structure Rationale

- **apps/web:** Self-contained Next.js app with its own deployment pipeline
- **apps/api:** Dedicated API server for heavier workloads; separates concerns from UI
- **apps/agent:** Separate package for agent with its own build/release process
- **packages/database:** Single source of truth for database schema; prevents drift
- **packages/types:** Shared TypeScript interfaces between all apps (critical for Agent↔Cloud contract)

## Architectural Patterns

### Pattern 1: Agent-Initiated Outbound Connection

**What:** Agent establishes outbound WebSocket connection to cloud, enabling NAT/firewall traversal without inbound port opening.

**When to use:** Customer environments with restrictive network policies.

**Trade-offs:** PRO: Easier customer deployment; CON: Cannot push commands instantly (requires connection retry).

```typescript
// Agent side (pseudocode)
const ws = new WebSocket('wss://cloud.example.com/agent/connect', {
  headers: { 'X-Agent-Token': agentToken }
});

ws.on('open', () => {
  // Authenticate and start heartbeat
  ws.send(JSON.stringify({ type: 'HELLO', agentId, capabilities }));
});

ws.on('message', (data) => {
  // Handle commands from cloud (restart container, update config)
  handleCommand(JSON.parse(data));
});
```

### Pattern 2: Tenant-Isolated Database with Row-Level Security

**What:** Single PostgreSQL database with RLS policies enforcing tenant isolation at query level.

**When to use:** Most SaaS scenarios; balances operational simplicity with security.

**Trade-offs:** PRO: Single database to manage; CON: RLS overhead, noisy neighbor risk at scale.

```sql
-- Enable RLS on hosts table
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see hosts in their organization
CREATE POLICY host_tenant_isolation ON hosts
  USING (organization_id = current_setting('app.current_org_id')::uuid);
```

### Pattern 3: Pull-Through Cache for Metrics

**What:** Agent buffers metrics locally and sends in batches; cloud pulls into Redis cache for real-time queries.

**When to use:** High-frequency metric collection to reduce API overhead.

**Trade-offs:** PRO: Reduces network calls, handles connectivity gaps; CON: Slight delay in real-time data.

### Pattern 4: Event-Driven Architecture for Actions

**What:** Cloud publishes action commands to Redis pub/sub; agent subscribes to tenant-specific channel.

**When to use:** Real-time action execution (restart, scale, logs).

**Trade-offs:** PRO: Scalable, decoupled; CON: Adds Redis dependency, potential message loss if disconnected.

## Data Flow

### Telemetry Flow (Agent → Cloud)

```
[Docker Daemon] ──(stats API)──► [Agent Collector]
                                        │
                                        ▼ (batched, every 10s)
                               [Agent Transport]
                                        │
                                        ▼ (WebSocket)
                            [Agent Gateway]
                                        │
                                        ▼
                               [Ingestion Service]
                                        │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
             [Metrics DB]          [Logs DB]            [Events DB]
             (TimescaleDB)         (Postgres JSONB)      (Postgres)
```

### Action Flow (Cloud → Agent)

```
[User clicks "Restart"] ──► [API validates permissions]
                                 │
                                 ▼
                          [Action Service]
                                 │
                                 ▼
                          [Redis Pub/Sub]
                                 │
                                 ▼
                    [WebSocket Server] ──► [Agent receives command]
                                 │
                                 ▼
                          [Audit Log DB]
```

### UI Data Flow

```
[User loads dashboard] ──► [API queries DB] ──► [Redis cache check]
                                    │                   │
                              ┌─────┴─────┐        [cache hit]
                              ▼           ▼
                         [Postgres]  [return cached]
                              │
                              ▼
                         [API response]
                              │
                              ▼
                         [Next.js UI]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|------------------------|
| 0-100 hosts | Single API instance, single PostgreSQL, single Redis |
| 100-1,000 hosts | Connection pooling (PgBouncer), Redis cluster, API horizontal scaling |
| 1,000-10,000 hosts | TimescaleDB for metrics, read replicas, WebSocket sharding by tenant |
| 10,000+ hosts | Multi-region deployment, agent aggregation, sampling at high load |

### Scaling Priorities

1. **First bottleneck: WebSocket connections**
   - Each agent holds persistent connection
   - Fix: Scale WebSocket servers horizontally, use Redis for connection state

2. **Second bottleneck: Metrics ingestion**
   - High-volume time-series data overwhelms primary DB
   - Fix: TimescaleDB for automatic partitioning, or offload to dedicated TSDB (Prometheus/InfluxDB)

3. **Third bottleneck: Query latency**
   - Dashboard queries become slow with large datasets
   - Fix: Redis caching layer, pre-aggregated rollups, read replicas

## Anti-Patterns

### Anti-Pattern 1: Direct Database Access from Agent

**What people do:** Agent connects directly to cloud database over the internet.

**Why it's wrong:** Exposes database to internet, no authentication on agent side, major security risk.

**Do this instead:** Agent-only WebSocket connection; all data flow through cloud API.

### Anti-Pattern 2: Storing Raw Logs in Primary Transaction DB

**What people do:** Insert high-volume container logs into same tables as relational data.

**Why it's wrong:** Log volume quickly dominates storage, impacts query performance, drives up costs.

**Do this instead:** Separate log storage (Postgres JSONB for moderate, or dedicated like Elasticsearch for high volume).

### Anti-Pattern 3: Polling-Based Agent Communication

**What people do:** Agent polls cloud API every N seconds for commands.

**Why it's wrong:** Adds latency for action execution, wastes bandwidth, doesn't scale.

**Do this instead:** WebSocket or long-lived HTTP connections (Server-Sent Events).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|--------------------|-------|
| Docker Engine | Unix socket or TCP | Agent needs access to `/var/run/docker.sock` or TCP (2375/2376) |
| Container Registry | HTTPS API | For agent auto-update functionality |
| Email Service | SMTP or API (SendGrid/Postmark) | For alerts, user invites |
| Auth Providers | OAuth2/OIDC | Optional: Google, GitHub SSO |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ API | REST/GraphQL | Consider tRPC for type safety |
| API ↔ WebSocket | Shared Redis pub/sub | Decouples scaling |
| API ↔ Database | Prisma/Query builder | Use connection pooling |
| Agent ↔ Cloud | WebSocket + JSON | Versioned protocol |

## Build Order Implications

Dependencies between components (build sequentially):

```
1. packages/database        ─── Shared DB schema, Prisma client
2. packages/types           ─── TypeScript interfaces
3. packages/config           ─── Shared configuration
4. apps/agent (basic)        ─── Can run standalone, log to stdout
5. apps/api (core)          ─── Tenant/Host CRUD, basic auth
6. apps/web (core)          ─── Dashboard, host list
7. apps/agent (connected)   ─── WebSocket connection to cloud
8. apps/api (metrics)       ─── Metrics ingestion endpoint
9. apps/web (metrics)       ─── Visualizations
10. apps/api (actions)      ─── Execute commands via WebSocket
11. apps/web (actions)      ─── Action UI, audit logs
12. Cross-cutting: RBAC, alerting, self-hosted mode
```

## Sources

- Datadog Agent Architecture (https://docs.datadoghq.com/agent/architecture/) — Industry standard for agent-based monitoring
- Multi-Tenant SaaS Architecture guides (https://isitdev.com/multi-tenant-saas-architecture-cloud-2025/) — Modern patterns
- OpAMP for agent fleet management (https://oneuptime.com/blog/post/2026-02-06-opamp-websocket-connections-realtime-fleet-control/) — WebSocket-based agent control
- TimescaleDB documentation — Time-series data at scale

---

*Architecture research for: Docker Monitoring SaaS*
*Researched: 2026-02-27*
