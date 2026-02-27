# Roadmap: Docker Dashboard Cloud

**Created:** 2026-02-27
**Core Value:** Enable users to monitor and manage Docker containers across multiple hosts from a single cloud interface, with secure agent-based connectivity that requires no inbound ports.

## Phases

- [ ] **Phase 1: Foundation & Identity** - User authentication, org/project structure, RBAC, local dev environment
- [ ] **Phase 2: Host Enrollment & Inventory** - Agent enrollment flow, fleet view, container listing
- [ ] **Phase 3: Observability & Actions** - Live metrics, log streaming, container actions, audit logging
- [ ] **Phase 4: Alerting** - Container alerts, alert lifecycle, webhook notifications

## Phase Details

### Phase 1: Foundation & Identity

**Goal:** Users can authenticate, create organizations/projects, and run the full local development stack

**Depends on:** Nothing (first phase)

**Requirements:** IDTY-01, IDTY-02, IDTY-03, IDTY-04, IDTY-05, IDTY-06, DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, DEV-06, DEV-07

**Success Criteria** (what must be TRUE):
1. User can sign up with email/password and log in with JWT tokens that persist sessions
2. User can create Organizations (tenants) and Projects within Organizations
3. User can invite other users to Organization and assign RBAC roles (Owner, Admin, Operator, Viewer)
4. Local development environment runs via docker-compose.dev.yml with Postgres, Redis, cloud-api, cloud-web, and Agent all connected
5. Seeded dev user exists for immediate testing without manual sign-up

**Plans:** 8/8 plans executed

**Plan list:**
- [x] 01-01-PLAN.md — Database Schema (User, Org, Project, Session models)
- [x] 01-02-PLAN.md — Docker Compose Dev Environment (PostgreSQL, Redis, LocalStack)
- [x] 01-03-PLAN.md — Agent Local Setup
- [x] 01-04-PLAN.md — Authentication API (register, login, logout)
- [x] 01-05-PLAN.md — Organizations & Projects API
- [x] 01-06-PLAN.md — RBAC & Invitations
- [x] 01-07-PLAN.md — Cloud API Service
- [x] 01-08-PLAN.md — Cloud Web UI

---

### Phase 2: Host Enrollment & Inventory

**Goal:** Users can enroll Docker hosts via agent installation and view container inventory across the fleet

**Depends on:** Phase 1

**Requirements:** HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, HOST-06, HOST-07, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05

**Success Criteria** (what must be TRUE):
1. User can add a new Host via UI, receiving a one-time enrollment token and agent installation command
2. Agent can enroll using the token, receive credentials, and establish heartbeat (10-30s) with cloud; system marks hosts as Online/Offline based on last_seen
3. User can view Fleet view showing all registered hosts with aggregate container counts and health status
4. User can view Host detail page with table of all containers, filterable by status and searchable by name/image

**Plans:** TBD

---

### Phase 3: Observability & Actions

**Goal:** Users can view live metrics/logs and execute container actions with full audit trail

**Depends on:** Phase 2

**Requirements:** METR-01, METR-02, METR-03, METR-04, METR-05, LOGS-01, LOGS-02, LOGS-03, LOGS-04, LOGS-05, LOGS-06, ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05, ACTN-06, ACTN-07, AUDT-01, AUDT-02, AUDT-03, AUDT-04

**Success Criteria** (what must be TRUE):
1. User can view live metrics stream (CPU, memory, network) updating every 1-5 seconds, plus historical charts for 15m/1h/6h/24h ranges (24h retention)
2. User can view live log tail from any container, pause/resume streaming, and download logs for a specified time range
3. User can start/stop/restart containers with reason/confirmation dialog; Protected containers policy blocks stop unless user has Admin role
4. Cloud sends action requests to agent via WebSocket; agent executes the action and returns success/failure result
5. User can view audit log showing all actions with actor_user_id, action type, target container, timestamp, and result (success/fail)

**Plans:** TBD

---

### Phase 4: Alerting

**Goal:** Users receive automated alerts when containers encounter issues, with webhook notification delivery

**Depends on:** Phase 3

**Requirements:** ALRT-01, ALRT-02, ALRT-03, ALRT-04, ALRT-05, ALRT-06, ALRT-07

**Success Criteria** (what must be TRUE):
1. System automatically detects and fires alerts for: container down (exited >N minutes), restart loop (>X restarts in Y minutes), CPU threshold exceeded (>N minutes), memory threshold exceeded (>N minutes)
2. Alerts support firing/resolved lifecycle state transitions (alert fires when condition met, resolves when condition clears)
3. Alerts support deduplication by rule_id + target to prevent alert storms from repeated conditions
4. System sends alert notifications via webhook to configured endpoints

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Identity | 8/8 | ✅ Complete | 2026-02-27 |
| 2. Host Enrollment & Inventory | 0/1 | Not started | - |
| 3. Observability & Actions | 0/1 | Not started | - |
| 4. Alerting | 0/1 | Not started | - |

---

*Last updated: 2026-02-27 after Phase 1 completion*
