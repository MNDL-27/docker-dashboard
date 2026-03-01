# Docker Dashboard Cloud

## What This Is

Docker Dashboard Cloud is a multi-tenant SaaS control plane plus a host agent that extends the existing self-hosted Docker Dashboard into a managed fleet product. Teams enroll Docker hosts with an outbound-only agent, then monitor containers, metrics, logs, and run safe actions from a centralized web app. The project also preserves a local/self-hosted mode for backward compatibility while introducing org/project/user boundaries and operational governance.

## Core Value

Operators can securely observe and control Docker containers across many hosts from one place without exposing inbound ports on customer infrastructure.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-tenant SaaS foundation with orgs, projects, users, and RBAC
- [ ] Secure host enrollment and durable agent connectivity (outbound-only)
- [ ] Fleet and host inventory views with container-level detail
- [ ] Live metrics and bounded historical telemetry for containers
- [ ] Live log tailing with bounded retention and download support
- [ ] Safe container lifecycle actions (start/stop/restart) with full audit history
- [ ] Basic alerting for uptime/resource health with notification delivery
- [ ] Local Docker Compose dev environment for cloud + agent workflows
- [ ] Monorepo migration that keeps existing self-hosted app working

### Out of Scope

- Kubernetes orchestration support — explicitly deferred beyond MVP
- Full-text log indexing/search platform — MVP keeps bounded retention and download
- Full Docker object management (images/volumes/networks) — not required for MVP value
- Native mobile apps — web-first delivery for MVP

## Context

- Existing repository already runs a self-hosted Docker Dashboard (Node.js/Express backend and static frontend) with container list, live stats, log streaming, and start/stop/restart controls.
- Target product adds a hosted cloud control plane and on-host agent model while preserving legacy self-hosted operation.
- Preferred stack direction from idea: TypeScript for new components, monorepo layout under `apps/` and `packages/`, Postgres for metadata, and optional Redis/object storage extensions as complexity grows.
- Planned product surface includes identity/tenancy, enrollment handshake, host heartbeat, inventory ingest, metrics/log pipelines, actions with RBAC guardrails, alerts, and auditability.
- MVP acceptance is explicitly outcome-based (enrollment success, host online visibility, fleet visibility, metrics/logs live UX, action execution with audit, and at least one alert type end-to-end).

## Constraints

- **Architecture**: Outbound-only agent connectivity — no inbound customer-host ports, reducing deployment friction and security exposure.
- **Security**: Tenant isolation and scoped authorization — org-level boundaries and RBAC enforcement are mandatory for every API/action path.
- **Credentials**: Enrollment token lifecycle controls — one-time/short-lived enrollment and protected long-lived agent credentials.
- **Compatibility**: Preserve legacy self-hosted mode — current Docker socket functionality must keep working during SaaS migration.
- **Operational**: Bounded telemetry retention — logs/metrics storage must stay cost-controlled in MVP.
- **Delivery**: Local reproducibility — full cloud+agent stack must run locally via compose for development and validation.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build a cloud control plane plus on-host agent model | Centralized multi-host visibility and control requires a hosted coordination layer while keeping customer-host networking simple | — Pending |
| Keep self-hosted app as a first-class mode | Existing functionality and users should not be broken during SaaS evolution | — Pending |
| Use monorepo structure with dedicated apps/packages | Separates cloud-web, cloud-api, selfhosted, agent, and shared concerns while enabling shared types/schemas | — Pending |
| Implement RBAC with Owner/Admin/Operator/Viewer roles in MVP | Action safety and tenant governance are core to trusted operations | — Pending |
| Prioritize webhook/email alerting after baseline observability and actions | Ensures MVP first delivers control + visibility before broader notification surface | — Pending |

---
*Last updated: 2026-03-01 after initialization*
