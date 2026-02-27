# Idea Document — Convert Docker Dashboard into a SaaS (Docker Dashboard Cloud)

## 0) Context (existing codebase)
This repository currently contains a self-hosted Docker Dashboard:
- Node.js/Express backend serving a static frontend
- Reads Docker Engine data (stats/logs) via Docker socket and/or optional Portainer gateway
- UI supports container list, live stats, log streaming, and start/stop/restart
Goal: evolve this into a SaaS while preserving a local/self-hosted mode.

## 1) Product goal (what to build)
Build “Docker Dashboard Cloud” (DDC): a hosted, multi-tenant control plane + an on-host Agent.
Customers install the Agent on each Docker host. The Agent connects outbound to the Cloud, streams telemetry (containers, metrics, logs, events) and receives action requests (restart/start/stop).

Primary outcomes:
1) Multi-tenant SaaS web app (Org/Projects/Users/RBAC)
2) Host enrollment + agent connectivity (secure, outbound-only)
3) Fleet view (hosts + containers), container detail (metrics + logs), and safe actions
4) Alerts (basic) + audit logs
5) Local dev environment via Docker Compose

Non-goals for MVP:
- Kubernetes support
- Full log indexing/search (basic retention + download only)
- Full image/volume/network management (future)

## 2) High-level architecture
### 2.1 Components
A) Cloud Control Plane
- Web UI (React/Next.js recommended)
- API service (Node/TS, REST for UI, WS for agent)
- Postgres DB (metadata + audit + alert rules)
- Redis (optional) for queues/caching (recommended for actions + alert eval)
- Object storage (optional) for logs later (MVP can store limited logs in DB)

B) Agent (runs on customer host)
- Connects to local Docker Engine (unix socket or local TCP)
- Streams:
  - host info + heartbeat
  - containers snapshot
  - metrics batches
  - logs batches (bounded)
  - docker events
- Executes actions requested by cloud:
  - start/stop/restart container

### 2.2 Connectivity rules
- Agent -> Cloud: outbound-only (no inbound ports required on customer)
- Transport: secure WebSocket (wss) or gRPC over TLS
- Auth: agent uses enrollment token to obtain long-lived credentials (rotate/refresh)

## 3) Repo restructuring (monorepo)
Convert this repo to a monorepo while keeping the existing self-hosted app.

Target structure:
- /apps
  - /selfhosted        (move current server/ + public/ here with minimal changes)
  - /cloud-web         (new SaaS UI)
  - /cloud-api         (new SaaS API + agent gateway)
- /packages
  - /agent             (new agent)
  - /shared            (shared types, schemas, utils)
- /infra
  - docker-compose.dev.yml (postgres, redis, localstack/minio optional)
- /docs
  - SAAS_OVERVIEW.md
  - AGENT_INSTALL.md
  - SECURITY.md
  - BILLING_PLANS.md

Package manager:
- Prefer pnpm workspaces (or npm workspaces if you want minimal tooling)

Language:
- TypeScript for new components (cloud-api, cloud-web, agent, shared)

## 4) MVP feature requirements (must implement)
### 4.1 Identity / Tenancy
- Orgs (tenant)
- Projects (environment grouping: prod/staging/homelab)
- Users + invites
- RBAC roles:
  - Owner (billing/users/all)
  - Admin (hosts/policies/integrations)
  - Operator (view + actions)
  - Viewer (read-only)

Auth:
- Email/password for MVP
- JWT access token + refresh token (or session cookies) for cloud-web <-> cloud-api

### 4.2 Host enrollment + Agent lifecycle
Cloud UI flow:
- “Add Host” -> create Host record -> generate one-time ENROLLMENT_TOKEN + install command

Agent install:
- `docker run` or compose snippet
- env:
  - DDC_CLOUD_URL
  - DDC_ENROLLMENT_TOKEN
  - DDC_HOST_NAME (optional)
  - DOCKER_HOST or mount docker.sock

Enrollment handshake:
- Agent connects, sends enrollment token + host info
- Cloud validates token, issues:
  - agent_id
  - agent_secret or client certificate (MVP: signed JWT secret)
- Agent stores credentials locally (in container volume)

Heartbeat:
- Agent sends heartbeat every 10–30s
- Cloud marks host online/offline based on last_seen

### 4.3 Inventory (containers)
- Agent sends container snapshot:
  - docker_id, name, image, status, labels, created, ports (if available), restart count
- Cloud stores latest snapshot per host
- Cloud-web views:
  - Fleet: all hosts + container counts
  - Host page: container table with filter/search

### 4.4 Metrics (live + short history)
Metrics collected per container (minimum):
- cpu_percent
- mem_used_bytes, mem_limit_bytes
- net_rx_bytes, net_tx_bytes
Optional if available:
- blk_read_bytes, blk_write_bytes

MVP retention:
- store 24h of metrics samples (plan-gated later)

UI:
- Container detail page:
  - live stream (1–5s updates)
  - charts for last 15m/1h/6h/24h

### 4.5 Logs (live tail + bounded storage)
Agent log streaming:
- Tail last N lines on connect (e.g., 200)
- Follow logs and batch upload in chunks
- Backpressure + size limits (per container and per host)
Storage MVP:
- Store only recent logs (e.g., last 50MB per container OR last 24h) in DB or in compressed files
UI:
- Live logs view
- Pause/resume
- Download logs for time range (MVP: limited)

### 4.6 Actions (start/stop/restart) + audit
Cloud-web triggers action -> cloud-api creates ActionRequest -> sends to agent -> agent executes -> returns result.

Constraints:
- Actions require Operator+ role
- “Protected containers” policy (MVP: per-project list) blocks stop unless Admin

Audit log:
- Always record:
  - actor_user_id
  - action type
  - target container
  - timestamp
  - result (success/fail + error)
  - optional “reason” string from UI

### 4.7 Alerts (basic)
Implement at least:
- Container down (exited) for > N minutes
- Restart loop: restarts > X in Y minutes
- CPU > threshold for N minutes
- Memory > threshold for N minutes

Notifications MVP:
- Email (SMTP env config) OR webhook (choose one; implement webhook first if faster)

Alert lifecycle:
- firing/resolved
- dedup by (rule_id + target)

## 5) Security requirements (must meet)
- Tenant isolation at API layer (org_id scoped everywhere)
- Agent credentials:
  - enrollment token is one-time + short-lived
  - agent secret stored encrypted at rest (DB) and never shown again
- Transport:
  - HTTPS/WSS only in production
- Least privilege:
  - Agent can be configured “monitor-only” (actions disabled)
- Rate limiting:
  - UI API endpoints rate-limited
  - Agent ingest endpoints rate-limited per host
- No insecure TLS bypass:
  - Do not disable TLS verification in production paths

## 6) Data model (minimum tables)
Postgres tables:
- users
- orgs
- memberships (user_id, org_id, role)
- projects (org_id)
- hosts (project_id, name, last_seen, status, agent_version)
- host_credentials (host_id, agent_id, agent_secret_hash, rotated_at)
- containers (host_id, docker_id, name, image, labels_json, status, restart_count, last_seen)
- metrics_samples (container_id, ts, cpu, mem_used, mem_limit, net_rx, net_tx, blk_r, blk_w)
- log_chunks (container_id, ts_start, ts_end, bytes, content_compressed or storage_ref)
- action_requests (org_id, project_id, host_id, container_id, type, reason, status, created_by, created_at)
- audit_records (org_id, actor_id, action, target, result, ts, metadata_json)
- alert_rules
- alert_instances

Use Prisma (recommended) or any ORM you prefer, but keep schema explicit and migration-driven.

## 7) API contracts (minimum)
### 7.1 UI REST API (cloud-web -> cloud-api)
- POST /auth/signup, /auth/login, /auth/refresh, /auth/logout
- GET/POST /orgs, /projects
- POST /projects/:id/hosts (create host + enrollment token)
- GET /hosts, /hosts/:id
- GET /hosts/:id/containers
- GET /containers/:id (detail)
- GET /containers/:id/metrics?range=15m|1h|6h|24h
- GET /containers/:id/logs?since=...&until=...
- POST /containers/:id/actions (start/stop/restart + reason)
- GET /audit
- CRUD /alerts

### 7.2 Agent gateway (agent <-> cloud-api)
Prefer a single WSS endpoint:
- WSS /agent/connect

Messages (JSON) with type field:
- agent.hello { enrollment_token?, agent_id?, host_info, agent_version }
- agent.heartbeat { ts }
- agent.containers.snapshot { containers:[...] }
- agent.metrics.batch { samples:[{container_docker_id, ts, ...}] }
- agent.logs.batch { chunks:[{container_docker_id, ts_start, ts_end, content}] }
- agent.events.batch { events:[...] }
- agent.action.result { action_id, status, output?, error? }

Cloud -> Agent:
- cloud.enroll.accept { agent_id, agent_secret }  (only once)
- cloud.action.request { action_id, container_docker_id, type, reason }

## 8) Local development deliverables (must include)
Provide a single local dev command that starts everything:
- Postgres
- Redis (optional)
- cloud-api
- cloud-web
- agent (pointing at local Docker)

Deliver:
- /infra/docker-compose.dev.yml
- Root README with:
  - setup
  - env vars
  - how to run agent against local docker
  - seeded dev user

## 9) Migration / compatibility with existing self-hosted app
- Keep /apps/selfhosted working with minimal changes
- Do not break current Docker socket functionality in self-hosted
- Clearly document:
  - “Self-hosted (legacy)”
  - “SaaS (cloud + agent)”

## 10) Acceptance criteria (definition of done for MVP)
1) User can sign up, create org + project
2) User can add a host and get an enrollment command
3) Agent enrolls successfully and host shows “Online”
4) Fleet shows containers from that host
5) Container detail shows:
   - live metrics updating
   - last 1h chart
   - live logs tail
6) Start/stop/restart works and is recorded in audit log
7) At least one alert type works end-to-end (container down) and posts to webhook/email
8) Everything runs locally via docker-compose.dev.yml

## 11) Implementation plan (work breakdown)
Phase A — Monorepo + cloud skeleton
- Create workspace + move existing app to /apps/selfhosted
- Scaffold /apps/cloud-api (TS) + /apps/cloud-web (Next)
- Setup Postgres schema + migrations
- Implement auth + org/project/memberships

Phase B — Agent + enrollment
- Build /packages/agent container
- Implement WSS connect + enrollment + heartbeat
- Host UI shows online/offline

Phase C — Inventory + metrics
- Implement container snapshots storage + UI tables
- Implement metrics ingest + charts + live stream

Phase D — Logs + actions + audit
- Implement logs batching + container logs UI
- Implement actions request/execute/results
- Implement audit log UI

Phase E — Alerts
- Implement rule engine (polling every 30–60s initially)
- Implement notify (webhook/email)

## 12) Constraints / notes
- Treat Docker access as privileged: keep action execution behind explicit RBAC.
- Keep telemetry bounded to control costs.
- Ensure SaaS licensing/commercial permissions are addressed separately (not a coding task here), but do not add restrictions in code that block SaaS mode.