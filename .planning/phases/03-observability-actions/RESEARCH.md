# Research: Observability & Actions (Phase 3)

## 1. Real-time Communication: WebSocket vs Server-Sent Events (SSE)

**Context:** The agent needs to stream metrics (every 1-5s) and logs (continuous) to the Cloud API. The Cloud API needs to stream this data to connected Web UI clients. The Cloud API also needs to send action commands (start/stop) down to the agent.

**Analysis:**
- **SSE (Server-Sent Events):**
  - *Pros:* Unidirectional (perfect for metrics/logs), built-in reconnection in browsers, uses standard HTTP/2 multiplexing, simple to implement on the frontend.
  - *Cons:* Strictly one-way (Server to Client). Cannot be used for the Cloud API to send commands *to* the Agent over the same connection if the Agent initiated it.
- **WebSocket:**
  - *Pros:* Bi-directional. A single connection can both push metrics/logs up to the cloud, and receive action commands down from the cloud.
  - *Cons:* Slightly heavier, requires custom reconnection logic, does not easily multiplex over a single HTTP/2 connection like SSE.

**Decision:** **WebSocket**
The requirement ACTN-06 ("Cloud sends action request to agent") over a secure agent-initiated connection heavily favors WebSockets. If the agent is behind a NAT/Firewall (no inbound ports per core value), the only way to send a command from Cloud -> Agent is if the Agent holds a persistent outbound connection open. A WebSocket is the standard way to achieve full-duplex communication in this scenario.

## 2. Metrics Storage: TimescaleDB vs Native Postgres

**Context:** Storing CPU, memory, and network metrics every 1-5 seconds per container can quickly generate millions of rows.

**Analysis:**
- **Native Postgres:** 
  - Fine for MVP if we aggregate or aggressively prune, but raw inserts at 1s intervals will bloat standard tables and index trees quickly. We would need heavy manual partitioning.
- **TimescaleDB:**
  - An extension for Postgres specifically designed for time-series.
  - Automatically partitions data into "chunks" across time.
  - Provides continuous aggregates (e.g., auto-rollup 1s data to 1m data).
  - Integrates perfectly with Prisma (Treats hypertables as normal tables).

**Decision:** **Native Postgres for MVP, with strict cleanup.**
*Reasoning for Phase 3:* While TimescaleDB is technically superior, the current local dev environment (`docker-compose.dev.yml`) uses the standard Postgres image (`postgres:15-alpine`). Switching to TimescaleDB requires changing the database image, potentially breaking existing data, and requires running manual SQL to create hypertables (which Prisma doesn't do natively via `db push`).
To respect the "Keep it Simple" ethos for this iteration, we will use a standard `ContainerMetric` table with a background cleanup job (or rely on the `24h retention` requirement via a scheduled deletion query). We can index on `(containerId, timestamp)`. If volume becomes an issue, we can introduce Timescale in a future phase.

## 3. Auth for WebSocket Connections

**Context:** WebSockets don't allow setting custom HTTP headers (like `Authorization: Bearer <token>`) easily via browser JS APIs. 

**Decision:** **Query Parameter or Ticket-based Auth**
- Agent -> Cloud: The Go agent can set HTTP headers during the WS handshake. We can continue using the existing JWT Bearer token.
- Cloud Web -> Cloud API: The Next.js frontend cannot easily set headers in the native `WebSocket` object. We will pass a short-lived ticket or the JWT token via a query parameter: `wss://api.../logs?token=...`. The WebSocket server will authenticate the connection during the upgrade request based on this token.

---
*Research completed: 2026-02-27*
