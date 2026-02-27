# Stack Research

**Domain:** Docker Monitoring SaaS with Agent-Based Connectivity
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x | Cloud UI (React framework) | Industry standard for SaaS dashboards, excellent SSR/ISR, App Router for maintainability |
| Node.js | 22.x (LTS) | API runtime | Same JS/TS across stack, excellent for I/O-heavy workloads, native WebSocket support |
| TypeScript | 5.x | Type safety | Critical for monorepo code sharing between agent and cloud |
| Turborepo | 2.x | Monorepo orchestration | Best-in-class caching, incremental builds, native Next.js support |

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 17.x | Primary relational DB | Best choice for multi-tenant SaaS, excellent JSON support, row-level security |
| TimescaleDB | 2.x | Time-series for metrics | PostgreSQL extension, hypertables for container metrics, native SQL queries |
| Redis | 7.x | Caching, sessions, pub/sub | Essential for WebSocket connection state, rate limiting, session management |

### Agent Runtime

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Go | 1.23.x | Agent implementation | Best for system-level metrics collection, small binary, excellent Docker client libraries |
| OR | Rust | Agent implementation | Alternative for performance-critical agents, smaller memory footprint than Go |
| docker/stats API | - | Container metrics | Standard Docker API, no agent inside container needed |

### Agent-Cloud Communication

| Technology | Purpose | Why Recommended |
|------------|---------|-----------------|
| **WebSocket (WSS)** | Primary agent ↔ cloud communication | NAT/firewall friendly (outbound only), familiar pattern, works through proxies |
| Server-Sent Events | Alternative for metrics streaming | Simpler than WebSocket, auto-reconnect, sufficient for one-way data |
| HTTP/REST | Commands from cloud to agent | Reliable, stateless, easy to implement retry logic |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma | 6.x | Type-safe ORM | When you need excellent DX with PostgreSQL |
| Drizzle ORM | 1.x | Lightweight ORM | When you want more control, faster cold starts |
| socket.io | 3.x | WebSocket abstraction | When you need rooms, auto-reconnect, fallback |
| ws | 9.x | Raw WebSocket | When you need minimal overhead, full control |
| dockerode | 4.x | Docker API client | For self-hosted mode, existing in codebase |
| @opentelemetry/* | 1.x | Observability | Standard for metrics collection, vendor-neutral |
| pino | 10.x | Structured logging | JSON logging, low overhead, Node.js native |
| zod | 3.x | Runtime validation | TypeScript-first, excellent error messages |

### Infrastructure

| Technology | Purpose | Notes |
|------------|---------|-------|
| Docker | Agent packaging | Single binary or minimal container for customer hosts |
| GitHub Actions | CI/CD | Free tier sufficient for start, native container builds |
| PostgreSQL (cloud) | Managed DB | Timescale Cloud, Neon, or Supabase for managed |
| Redis (cloud) | Managed Redis | Upstash, Redis Cloud, or managed service |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + Prettier | Code quality | Standard for TypeScript projects |
| changeset | Version management | Better than standard semver for monorepos |
| pnpm | Package manager | Faster, better disk usage than npm/yarn |
| docker buildx | Multi-arch builds | For ARM64/AMD64 agent binaries |

## Agent Communication Patterns

### Recommended: WebSocket with Outbound Connections

```
Customer Firewall
┌─────────────────┐     Outbound WSS      ┌─────────────────┐
│   Docker Host   │ ◄────────────────────► │   Cloud API     │
│                 │                        │   (Next.js)     │
│  ┌───────────┐  │                        │                 │
│  │  Agent    │  │                        │  ┌───────────┐  │
│  │ (Go/Rust) │  │                        │  │ WebSocket │  │
│  └───────────┘  │                        │  │  Server   │  │
└─────────────────┘                        └─────────────────┘
```

**Why WebSocket (not gRPC):**
- **Firewall/NAT friendly**: Agent connects outbound, no inbound rules needed
- **Traverse proxies**: Works through corporate proxies that block gRPC
- **Simpler deployment**: No need for TLS certificates on agent side initially
- **Browser-compatible**: Same protocol can be used for real-time UI updates
- **Bidirectional**: Can push commands to agents while receiving metrics

**Why NOT gRPC for agent communication:**
- Requires inbound ports or complex NAT traversal
- HTTP/2 not always available through corporate proxies
- More complex to debug without tooling
- WebSocket is sufficient for metrics volume (not performance-critical path)

**When gRPC IS appropriate:**
- Service-to-service inside your own infrastructure
- When you control the network environment
- When you need advanced load balancing (gRPC streaming)

## Installation

```bash
# Core - for monorepo root
pnpm add -w turbo@2
pnpm add -w typescript@5

# Cloud API (apps/api)
pnpm add @prisma/client prisma pino ws socket.io zod
pnpm add -D typescript @types/node @types/ws prisma

# UI (apps/web)
pnpm add next@15 react@19 @tanstack/react-query
pnpm add -D @types/node eslint prettier

# Agent (packages/agent) - Go
# go.mod
module github.com/docker-dashboard/agent

go 1.23
require (
	github.com/docker/docker v27.x
	github.com/gorilla/websocket v1.x
	github.com/prometheus/client_golang v1.x
)
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|------------------------|
| Agent language | Go | Rust | If team expertise exists, need minimum memory |
| Agent ↔ Cloud | WebSocket | gRPC | When network is controlled, performance critical |
| ORM | Prisma | Drizzle | When cold start matters, smaller bundle size |
| Time-series | TimescaleDB | ClickHouse | When write throughput > 100K events/sec |
| Real-time | socket.io | Raw ws | When you need rooms, browser fallback |
| Package manager | pnpm | npm | If team already uses npm exclusively |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| gRPC for agent↔cloud | Firewall/proxy traversal issues | WebSocket with TLS |
| MongoDB | Operational complexity, no time-series support | PostgreSQL + TimescaleDB |
| MySQL | No JSON support, worse full-text | PostgreSQL |
| Redis (for metrics) | Not designed for time-series queries | TimescaleDB hypertables |
| Agent inside container | Requires customers to modify docker configs | Standalone binary or sidecar |
| Long-polling | Inefficient, unnecessary overhead | WebSocket |
| REST for real-time | Not suitable for streaming | WebSocket or SSE |

## Stack Patterns by Variant

**If preserving self-hosted mode:**
- Use dockerode in API for local Docker socket
- Agent becomes optional (local mode uses direct API)
- Shared types between cloud API and self-hosted API

**If prioritizing multi-tenant isolation:**
- Use Row-Level Security (RLS) in PostgreSQL
- Add tenant_id to all queries via middleware
- Consider schema-per-tenant for compliance-heavy customers

**If high agent volume (1000+):**
- Consider gRPC for agent↔cloud (more efficient)
- Use connection pooling aggressively
- Implement agent heartbeat/heartbeat with backpressure

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15 | Node.js 20+, React 19 | App Router required |
| Prisma 6 | PostgreSQL 12+, TimescaleDB | Full hypertable support |
| Turborepo 2 | pnpm 8+, npm 9+, yarn 1.23+ | Remote caching |
| Go 1.23 | Docker Engine 20.x+ | API compatibility |

## Sources

- **WebSocket vs gRPC**: [Ably - gRPC vs WebSocket](https://ably.com/topic/grpc-vs-websocket) — WebSocket better for client-facing/agent scenarios
- **Datadog Agent Architecture**: [Datadog Agent Architecture](https://docs.datadoghq.com/agent/architecture/) — Industry standard agent pattern
- **OpenTelemetry**: [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) — Vendor-neutral metrics standard
- **TimescaleDB Multi-tenancy**: [Timescale Multi-tenancy](https://www.timescale.com/blog/building-multi-tenant-rag-applications-with-postgresql-choosing-the-right-approach/) — PostgreSQL-based approach
- **Monorepo patterns**: [Turborepo Next.js](https://turbo.build/repo/docs/guides/frameworks/nextjs) — Official monorepo guidance

---

*Stack research for Docker Monitoring SaaS*
*Researched: 2026-02-27*
