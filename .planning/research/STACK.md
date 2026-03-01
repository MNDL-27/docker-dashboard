# Stack Research

**Domain:** Multi-tenant Docker fleet observability/control SaaS with outbound-only agents
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24.x LTS (24.14.0 current LTS line) | Runtime for cloud API, web app, and shared packages | Best fit for a TypeScript-first monorepo that must preserve an existing Node/Express self-hosted app while adding SaaS services. |
| TypeScript | 5.9.x (5.9.3) | Shared type contracts across cloud API, agent, and UI | Reduces integration drift between agent payloads, ingestion APIs, and frontend queries; critical for multi-service monorepo velocity. |
| Next.js | 16.1.x (16.1.6) | Cloud web app + BFF-style API routes where useful | Standard React production framework in 2025-2026 with mature App Router, built-in server rendering, and strong operational tooling. |
| Fastify | 5.7.x (5.7.4) | High-throughput control-plane API services | Better latency/throughput profile than Express for ingest and agent-heartbeat paths, with low overhead and solid TS ergonomics. |
| PostgreSQL | 18.x (18.3 current) | System of record: tenants, users, hosts, enrollment, action/audit metadata | Correct default for strongly relational multi-tenant SaaS with transactional guarantees and robust indexing/query features. |
| ClickHouse | 25.8 LTS (25.8.17.37-lts) | Metrics/log event storage with TTL retention | Purpose-built for high-ingest observability analytics and cheap retention controls; avoids overloading Postgres with telemetry workloads. |
| NATS + JetStream | 2.12.x (2.12.4) | Durable command/event backbone between API workers and agent sessions | Lightweight, operationally simpler than Kafka for this scope; JetStream adds replay/durability needed for intermittent host connectivity. |
| Redis | 8.6.x (8.6.1) | Cache, rate limiting, idempotency keys, short-lived coordination | Fast ephemeral state for SaaS control planes; keeps hot-path lookups and throttling out of Postgres. |
| OpenTelemetry Collector | 0.146.x (0.146.1) | Unified telemetry ingestion/processing pipeline | Standard open telemetry pipeline component; future-proofs signal routing and vendor portability (OTLP-first). |
| OpenFGA | 1.11.x (1.11.6) | Fine-grained authorization (org/project/host/action relationships) | Better long-term fit than ad-hoc role checks when tenant/resource graph grows; keeps authz model explicit and testable. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm + drizzle-kit | 0.45.1 + 0.31.9 | Type-safe SQL + migrations | Default for control-plane metadata services; keep SQL explicit and migration-safe in monorepo CI. |
| zod | 4.3.6 | Runtime schema validation for API/agent payloads | Validate all ingress boundaries (agent check-ins, action requests, web mutations). |
| jose | 6.1.3 | JWT/JWS/JWK handling | Token issuance/verification for SaaS auth, service-to-service identities, and enrollment credential flows. |
| @openfga/sdk | 0.9.3 | Programmatic authz checks from API services | Use for authorization middleware and pre-action permission checks. |
| bullmq | 5.70.1 | Background jobs (alerts, retries, notifications) | Use for delayed/retry workflows not suited to request/response paths. |
| pino | 10.3.1 | Structured application logging | Standardize service logs with correlation IDs for audit and incident response. |
| @opentelemetry/sdk-node | 0.212.0 | Service instrumentation bootstrap | Instrument API and workers; forward through Collector to ClickHouse/monitoring sinks. |
| @tanstack/react-query | 5.90.21 | Server-state management in web app | Use for fleet tables, metrics cards, and action status polling with cache-aware UX. |
| dockerode | 4.0.9 | Docker Engine API client in legacy/self-hosted surfaces | Keep existing self-hosted behavior while introducing shared action semantics used by the agent path. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm 10.30.x | Workspace package manager | Fast monorepo installs, strict node_modules layout, good lockfile behavior for CI reproducibility. |
| Turborepo 2.8.x | Task graph + remote/local cache | Speeds multi-app builds/tests while preserving clear package boundaries between cloud and self-hosted modes. |
| Docker Compose | Local cloud+agent integration environment | Canonical local workflow for multi-container SaaS + agent simulation, matching project constraints. |
| Vitest 4.0.x + Playwright | Unit/integration + end-to-end validation | Vitest for package-level speed; Playwright for critical enroll/heartbeat/action UX paths. |

## Installation

```bash
# Core
npm install next@16.1.6 react@19.2.4 react-dom@19.2.4 typescript@5.9.3 fastify@5.7.4 pg@8.19.0 drizzle-orm@0.45.1 zod@4.3.6 jose@6.1.3

# Supporting
npm install bullmq@5.70.1 ioredis@5.10.0 nats@2.29.3 @openfga/sdk@0.9.3 @opentelemetry/sdk-node@0.212.0 @opentelemetry/auto-instrumentations-node@0.70.1 pino@10.3.1 @tanstack/react-query@5.90.21 dockerode@4.0.9

# Dev dependencies
npm install -D drizzle-kit@0.31.9 vitest@4.0.18 eslint@10.0.2 prettier@3.6.1 turbo@2.8.12
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fastify 5 | NestJS 11 | Use NestJS if your team strongly prefers DI/module conventions and accepts extra abstraction overhead. |
| ClickHouse 25.8 LTS | Loki 3.6 + Prometheus/VictoriaMetrics | Use Loki/Prometheus if the org already runs Grafana-native ops and can absorb higher multi-component ops complexity. |
| OpenFGA 1.11 | Postgres-only RBAC tables + CASL | Use simple RBAC-only checks early if authorization needs remain shallow (no resource graph). Migrate once policy graph complexity appears. |
| NATS JetStream 2.12 | Kafka/Redpanda | Use Kafka-class systems only when throughput/retention requirements exceed NATS operational sweet spot. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Postgres-only telemetry storage | Container metrics/log streams will bloat OLTP tables, degrade tenant metadata performance, and raise costs | Keep Postgres for metadata; use ClickHouse for telemetry with TTL policies |
| Ad-hoc RBAC in code (if/else by role only) | Becomes unmaintainable as org/project/host/action relationships expand; high risk of authorization bugs | Use OpenFGA-backed relationship checks plus explicit role bootstrap rules |
| Long-lived static enrollment tokens | High blast radius if leaked; difficult to rotate/contain | Use short-lived one-time enrollment tokens + rotated agent credentials |
| Elasticsearch-first logging stack for MVP | Higher ops burden and tuning complexity than needed for bounded-retention SaaS MVP | Use ClickHouse + object storage exports; revisit ES only for deep full-text search needs |

## Stack Patterns by Variant

**If SaaS multi-tenant cloud (primary target):**
- Use Postgres + ClickHouse + Redis + NATS + OpenFGA
- Because this cleanly separates OLTP metadata, telemetry analytics, cache/coordination, event durability, and authz graph growth.

**If legacy self-hosted mode (same monorepo):**
- Keep existing Express/docker-socket behavior behind compatibility adapters; share DTOs/validation/actions packages with cloud services
- Because backward compatibility is a hard constraint, and adapter boundaries avoid blocking SaaS evolution.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.1.6 | react@19.2.4 | Next docs list 16.1.6 as latest docs version; pair with current React 19 line. |
| fastify@5.7.4 | @fastify/websocket@11.2.0 | Keep plugin major aligned with Fastify major for ecosystem compatibility. |
| drizzle-orm@0.45.1 | pg@8.19.0 | Stable TS + Postgres pairing for typed SQL workflows. |
| bullmq@5.70.1 | ioredis@5.10.0 | Recommended modern pairing for queue reliability features. |

## Recommendation Confidence

| Area | Confidence | Why |
|------|------------|-----|
| Control-plane app stack (Node/TS/Next/Fastify) | HIGH | Verified by official docs/npm current versions; aligns with existing Node self-hosted baseline and monorepo constraint. |
| Data plane split (Postgres + ClickHouse) | MEDIUM-HIGH | Strong official signals on current versions and broad industry practice for observability SaaS; exact sizing/tuning remains workload-specific. |
| Messaging (NATS JetStream) | MEDIUM-HIGH | Official docs clearly support durability/replay and websocket connectivity; still requires phase-level validation under target ingest volume. |
| Authorization (OpenFGA) | MEDIUM | Strong fit for multi-tenant resource-relationship growth, but team familiarity and policy modeling effort must be validated in early phase. |

## Sources

- Node.js releases: https://nodejs.org/en/about/previous-releases (official, includes v24 Active LTS and release status) - HIGH
- Next.js docs: https://nextjs.org/docs (official, shows latest docs version 16.1.6) - HIGH
- PostgreSQL docs current: https://www.postgresql.org/docs/current/index.html (official, current 18.3) - HIGH
- Docker Compose docs: https://docs.docker.com/compose/ (official compose workflow reference) - HIGH
- NATS JetStream concepts: https://docs.nats.io/nats-concepts/jetstream (official JetStream durability/replay model) - HIGH
- NATS WebSocket config: https://docs.nats.io/running-a-nats-service/configuration/websocket (official websocket support notes) - HIGH
- OpenTelemetry Collector docs: https://opentelemetry.io/docs/collector/ (official collector deployment patterns) - HIGH
- ClickHouse docs install/observability sections: https://clickhouse.com/docs/en/install and https://clickhouse.com/docs/use-cases/observability (official product guidance) - MEDIUM-HIGH
- Redis latest release: https://api.github.com/repos/redis/redis/releases/latest (official GitHub release API, 8.6.1) - MEDIUM-HIGH
- NATS server latest release: https://api.github.com/repos/nats-io/nats-server/releases/latest (official GitHub release API, v2.12.4) - MEDIUM-HIGH
- ClickHouse latest LTS release: https://api.github.com/repos/ClickHouse/ClickHouse/releases/latest (official GitHub release API, v25.8.17.37-lts) - MEDIUM-HIGH
- OpenTelemetry Collector latest release: https://api.github.com/repos/open-telemetry/opentelemetry-collector/releases/latest (official GitHub release API, v0.146.1) - MEDIUM-HIGH
- OpenFGA latest release: https://api.github.com/repos/openfga/openfga/releases/latest (official GitHub release API, v1.11.6) - MEDIUM-HIGH
- NPM package versions (queried 2026-03-01): https://www.npmjs.com/ (official registry) - HIGH

---
*Stack research for: Docker fleet observability/control SaaS with outbound agent architecture*
*Researched: 2026-03-01*
