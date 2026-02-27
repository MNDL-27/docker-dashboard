# Requirements: Docker Dashboard Cloud

**Defined:** 2026-02-27
**Core Value:** Enable users to monitor and manage Docker containers across multiple hosts from a single cloud interface, with secure agent-based connectivity that requires no inbound ports.

## v1 Requirements

### Identity & Tenancy

- [x] **IDTY-01**: User can sign up with email and password
- [x] **IDTY-02**: User can log in and stay logged in via JWT tokens
- [x] **IDTY-03**: User can create an Organization (tenant)
- [x] **IDTY-04**: User can create Projects within an Organization
- [x] **IDTY-05**: User can invite other users to Organization
- [x] **IDTY-06**: User can have RBAC roles: Owner, Admin, Operator, Viewer

### Host Enrollment

- [ ] **HOST-01**: User can add a new Host via UI (creates enrollment token)
- [ ] **HOST-02**: System generates one-time enrollment token for agent
- [ ] **HOST-03**: System provides agent installation command with token
- [ ] **HOST-04**: Agent can enroll using enrollment token
- [ ] **HOST-05**: System validates enrollment token and issues agent credentials
- [ ] **HOST-06**: Agent sends heartbeat every 10-30 seconds
- [ ] **HOST-07**: System marks host as Online/Offline based on last_seen

### Inventory (Containers)

- [ ] **CONT-01**: Agent sends container snapshot (docker_id, name, image, status, labels, ports)
- [ ] **CONT-02**: Cloud stores latest container snapshot per host
- [ ] **CONT-03**: User can view Fleet view with all hosts and container counts
- [ ] **CONT-04**: User can view Host page with container table
- [ ] **CONT-05**: User can filter and search containers on Host page

### Metrics

- [ ] **METR-01**: Agent collects CPU, memory, network metrics per container
- [ ] **METR-02**: Agent sends metrics batches to cloud
- [ ] **METR-03**: Cloud stores metrics with 24h retention
- [ ] **METR-04**: User can view live metrics stream (1-5s updates)
- [ ] **METR-05**: User can view metrics charts for 15m/1h/6h/24h ranges

### Logs

- [ ] **LOGS-01**: Agent tails last N lines on connect (e.g., 200)
- [ ] **LOGS-02**: Agent streams logs in batches to cloud
- [ ] **LOGS-03**: Cloud stores recent logs (bounded storage)
- [ ] **LOGS-04**: User can view live logs tail
- [ ] **LOGS-05**: User can pause/resume log streaming
- [ ] **LOGS-06**: User can download logs for time range

### Actions

- [ ] **ACTN-01**: User can start a container (Operator+ role)
- [ ] **ACTN-02**: User can stop a container (Operator+ role)
- [ ] **ACTN-03**: User can restart a container (Operator+ role)
- [ ] **ACTN-04**: Actions require reason/confirmation
- [ ] **ACTN-05**: Protected containers policy blocks stop unless Admin
- [ ] **ACTN-06**: Cloud sends action request to agent
- [ ] **ACTN-07**: Agent executes action and returns result

### Audit

- [ ] **AUDT-01**: System records all actions with actor_user_id
- [ ] **AUDT-02**: System records action type and target container
- [ ] **AUDT-03**: System records timestamp and result (success/fail)
- [ ] **AUDT-04**: User can view audit log

### Alerts

- [ ] **ALRT-01**: Alert when container is down (exited) for > N minutes
- [ ] **ALRT-02**: Alert on restart loop (> X restarts in Y minutes)
- [ ] **ALRT-03**: Alert when CPU > threshold for N minutes
- [ ] **ALRT-04**: Alert when Memory > threshold for N minutes
- [ ] **ALRT-05**: Alerts support firing/resolved lifecycle
- [ ] **ALRT-06**: Alerts support deduplication by rule_id + target
- [ ] **ALRT-07**: System sends alert notifications via webhook

### Local Development

- [x] **DEV-01**: Local dev environment via docker-compose.dev.yml
- [x] **DEV-02**: Postgres available in local dev
- [x] **DEV-03**: Redis available in local dev
- [ ] **DEV-04**: cloud-api runs locally
- [ ] **DEV-05**: cloud-web runs locally
- [ ] **DEV-06**: Agent can run against local Docker
- [ ] **DEV-07**: Seeded dev user for testing

## v2 Requirements

### Identity & Tenancy

- **IDTY-07**: User can use OAuth login (Google, GitHub)
- **IDTY-08**: User can reset password via email

### Alerts

- **ALRT-08**: Alert notifications via email (SMTP)
- **ALRT-09**: User can configure notification preferences
- **ALRT-10**: Alert routing to multiple channels

### Observability

- **METR-06**: Block I/O metrics collection
- **METR-07**: Extended metrics retention (7 days)
- **LOGS-07**: Extended log retention

### Management

- **CONT-06**: Basic image management view
- **CONT-07**: Volume information display
- **CONT-08**: Network information display

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes support | Fundamentally different architecture, defer to v2+ |
| Full log indexing/search | Extremely expensive at scale, basic retention only for MVP |
| Image/volume/network management | Beyond monitoring scope, defer to future |
| Custom dashboards | Pre-built dashboards sufficient for MVP |
| Billing/payments | Addressed separately as business concern |
| Mobile app | Web-first approach, mobile later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDTY-01 | Phase 1 | Complete |
| IDTY-02 | Phase 1 | Complete |
| IDTY-03 | Phase 1 | Complete |
| IDTY-04 | Phase 1 | Complete |
| IDTY-05 | Phase 1 | Complete |
| IDTY-06 | Phase 1 | Complete |
| HOST-01 | Phase 2 | Pending |
| HOST-02 | Phase 2 | Pending |
| HOST-03 | Phase 2 | Pending |
| HOST-04 | Phase 2 | Pending |
| HOST-05 | Phase 2 | Pending |
| HOST-06 | Phase 2 | Pending |
| HOST-07 | Phase 2 | Pending |
| CONT-01 | Phase 2 | Pending |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 2 | Pending |
| CONT-04 | Phase 2 | Pending |
| CONT-05 | Phase 2 | Pending |
| METR-01 | Phase 3 | Pending |
| METR-02 | Phase 3 | Pending |
| METR-03 | Phase 3 | Pending |
| METR-04 | Phase 3 | Pending |
| METR-05 | Phase 3 | Pending |
| LOGS-01 | Phase 3 | Pending |
| LOGS-02 | Phase 3 | Pending |
| LOGS-03 | Phase 3 | Pending |
| LOGS-04 | Phase 3 | Pending |
| LOGS-05 | Phase 3 | Pending |
| LOGS-06 | Phase 3 | Pending |
| ACTN-01 | Phase 3 | Pending |
| ACTN-02 | Phase 3 | Pending |
| ACTN-03 | Phase 3 | Pending |
| ACTN-04 | Phase 3 | Pending |
| ACTN-05 | Phase 3 | Pending |
| ACTN-06 | Phase 3 | Pending |
| ACTN-07 | Phase 3 | Pending |
| AUDT-01 | Phase 3 | Pending |
| AUDT-02 | Phase 3 | Pending |
| AUDT-03 | Phase 3 | Pending |
| AUDT-04 | Phase 3 | Pending |
| ALRT-01 | Phase 4 | Pending |
| ALRT-02 | Phase 4 | Pending |
| ALRT-03 | Phase 4 | Pending |
| ALRT-04 | Phase 4 | Pending |
| ALRT-05 | Phase 4 | Pending |
| ALRT-06 | Phase 4 | Pending |
| ALRT-07 | Phase 4 | Pending |
| DEV-01 | Phase 1 | Complete |
| DEV-02 | Phase 1 | Complete |
| DEV-03 | Phase 1 | Complete |
| DEV-04 | Phase 1 | Pending |
| DEV-05 | Phase 1 | Pending |
| DEV-06 | Phase 1 | Pending |
| DEV-07 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
