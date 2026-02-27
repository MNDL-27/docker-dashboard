# Docker Dashboard Cloud

## What This Is

A hosted, multi-tenant SaaS control plane for Docker monitoring and management. Customers install an Agent on each Docker host that connects outbound to the Cloud, streaming telemetry (containers, metrics, logs, events) and receiving action requests. The existing self-hosted Docker Dashboard is preserved as a legacy mode.

## Core Value

Enable users to monitor and manage Docker containers across multiple hosts from a single cloud interface, with secure agent-based connectivity that requires no inbound ports.

## Requirements

### Validated

- ✓ Self-hosted Docker Dashboard — existing self-hosted mode with Docker socket access — current

### Active

- [ ] Multi-tenant SaaS web app (Org/Projects/Users/RBAC)
- [ ] Host enrollment + secure agent connectivity (outbound-only)
- [ ] Fleet view (hosts + containers)
- [ ] Container detail with live metrics and logs
- [ ] Container actions (start/stop/restart) with audit logging
- [ ] Basic alerts (container down, restart loop, CPU/memory thresholds)
- [ ] Local development environment via Docker Compose

### Out of Scope

- Kubernetes support — beyond MVP scope
- Full log indexing/search — basic retention + download only for MVP
- Full image/volume/network management — deferred to future
- Billing/payments integration — addressed separately

## Context

**Existing Codebase:**
- Node.js/Express backend serving static frontend
- Reads Docker Engine data via Docker socket and/or optional Portainer gateway
- UI supports container list, live stats, log streaming, and start/stop/restart

**Target Architecture:**
- Cloud Control Plane: Next.js UI + Node/TS API + Postgres + Redis (optional)
- Agent: Runs on customer Docker host, connects via secure WebSocket
- Monorepo structure with /apps and /packages

## Constraints

- **Security**: Tenant isolation required; agent credentials must be secured; HTTPS/WSS only in production
- **Connectivity**: Agent → Cloud must be outbound-only (no inbound ports on customer)
- **Data Retention**: MVP metrics stored for 24h; logs bounded to control costs
- **RBAC**: Action execution requires Operator+ role; protected containers policy blocks stop unless Admin

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebSocket for agent communication | Outbound-only connectivity requirement; real-time streaming | — Pending |
| Prisma ORM | Explicit schema with migrations; works well with Postgres | — Pending |
| pnpm workspaces | Fast, efficient package management for monorepo | — Pending |
| Next.js for cloud-web | React/Next.js recommended in idea doc; good developer experience | — Pending |
| TypeScript for all new components | Type safety for complex multi-service architecture | — Pending |

---
*Last updated: 2026-02-27 after initialization*
