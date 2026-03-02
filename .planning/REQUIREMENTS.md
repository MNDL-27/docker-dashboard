# Requirements: Docker Dashboard Cloud

**Defined:** 2026-03-01
**Core Value:** Operators can securely observe and control Docker containers across many hosts from one place without exposing inbound ports on customer infrastructure.

## v1 Requirements

Requirements for initial release. Each maps to exactly one roadmap phase.

### Identity and Tenancy

- [x] **TEN-01**: User can create an organization tenant.
- [x] **TEN-02**: User can create projects within an organization to segment environments.
- [x] **TEN-03**: User can invite another user to an organization.
- [x] **TEN-04**: User can assign membership roles (Owner, Admin, Operator, Viewer).
- [x] **TEN-05**: User can access only data for organizations and projects they belong to.

### Authentication and Sessions

- [x] **AUTH-01**: User can create an account with email and password.
- [x] **AUTH-02**: User can log in with email and password.
- [x] **AUTH-03**: User can refresh or continue an authenticated session without re-entering credentials.
- [x] **AUTH-04**: User can log out and invalidate active session state.

### Host Enrollment and Agent Lifecycle

- [ ] **ENRL-01**: User can create a host record and generate a one-time enrollment token.
- [ ] **ENRL-02**: User can view an install command/snippet for enrolling an agent with cloud URL and token.
- [ ] **ENRL-03**: Platform can validate enrollment token and issue durable agent credentials on first connect.
- [ ] **ENRL-04**: Platform can mark host online/offline from heartbeat freshness.
- [ ] **ENRL-05**: User can see host connectivity status and last-seen timestamp.

### Inventory and Fleet Views

- [ ] **INVT-01**: User can view fleet-level host and container counts.
- [ ] **INVT-02**: User can view containers for a selected host with status, image, labels, and restart count.
- [ ] **INVT-03**: User can filter/search host container lists.

### Metrics and Container Detail

- [ ] **METR-01**: User can view live container metrics updates (CPU, memory, network, restart indicators).
- [ ] **METR-02**: User can view recent metrics history windows (15m, 1h, 6h, 24h).
- [ ] **METR-03**: Platform can retain metrics samples for at least 24 hours in MVP.

### Logs

- [ ] **LOGS-01**: User can view live log tail for a container.
- [ ] **LOGS-02**: User can pause and resume live log streaming.
- [ ] **LOGS-03**: User can download logs for a selected time range.
- [ ] **LOGS-04**: Platform can enforce bounded log retention per container/host.

### Actions and Audit

- [ ] **ACTN-01**: User with Operator-or-higher role can request start, stop, and restart actions for a container.
- [ ] **ACTN-02**: Platform can dispatch action requests to the correct connected agent and track result status.
- [ ] **ACTN-03**: User can see action result feedback (success/failure and error details when available).
- [ ] **ACTN-04**: Platform can block protected-container stop requests unless user has Admin-or-higher role.
- [ ] **ACTN-05**: Platform always records immutable audit entries for container actions, including actor, target, timestamp, reason, and result.

### Alerts and Notifications

- [ ] **ALRT-01**: User can create alert rules for container down duration.
- [ ] **ALRT-02**: User can create alert rules for restart-loop thresholds.
- [ ] **ALRT-03**: User can create alert rules for sustained CPU and memory thresholds.
- [ ] **ALRT-04**: Platform can emit firing and resolved alert states with deduplication by rule and target.
- [ ] **ALRT-05**: Platform can deliver alert notifications through at least one channel (webhook or email).

### Security and Guardrails

- [ ] **SECU-01**: Platform enforces tenant isolation on all API and data access paths.
- [ ] **SECU-02**: Platform supports HTTPS/WSS-only transport in production configuration.
- [ ] **SECU-03**: Platform can rate-limit UI API traffic and agent ingest traffic per host.
- [ ] **SECU-04**: User can configure monitor-only agent mode that disables action execution.

### Developer Experience and Local Environment

- [ ] **DEVX-01**: Developer can start cloud-api, cloud-web, data services, and a local agent using one documented local command.
- [ ] **DEVX-02**: Developer can follow root documentation for setup, environment variables, and seeded local user flow.

### Compatibility and Migration

- [ ] **COMP-01**: User can continue using the existing self-hosted dashboard mode after SaaS components are introduced.
- [ ] **COMP-02**: Documentation clearly distinguishes self-hosted and SaaS operating modes.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Operations

- **DIFF-01**: User can view a correlated incident timeline combining actions, logs, metrics, and alerts.
- **DIFF-02**: User can enable bandwidth-aware async agent mode profiles for constrained sites.
- **DIFF-03**: User can apply prebuilt Docker health alert packs by workload type.

### Expanded Platform Surface

- **PLAT-01**: User can run selective full-text log indexing/search tiers.
- **PLAT-02**: User can manage Docker images, volumes, and networks from cloud UI.
- **PLAT-03**: User can onboard and manage Kubernetes clusters.

## Out of Scope

Explicitly excluded from MVP to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Kubernetes support in MVP | Massive scope increase beyond Docker-first value delivery |
| Full-text log indexing/search in MVP | High cost and complexity before core control-plane workflows are validated |
| Full Docker object management in MVP | Broadens permissions and blast radius before core container lifecycle workflows are stable |
| Arbitrary remote shell/command execution | Security/compliance risk exceeds MVP safety goals |
| Unbounded default telemetry retention | Breaks bounded-cost operating model and unit economics |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEN-01 | Phase 2 | Complete |
| TEN-02 | Phase 2 | Complete |
| TEN-03 | Phase 2 | Complete |
| TEN-04 | Phase 2 | Complete |
| TEN-05 | Phase 2 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| ENRL-01 | Phase 3 | Pending |
| ENRL-02 | Phase 3 | Pending |
| ENRL-03 | Phase 3 | Pending |
| ENRL-04 | Phase 3 | Pending |
| ENRL-05 | Phase 3 | Pending |
| INVT-01 | Phase 4 | Pending |
| INVT-02 | Phase 4 | Pending |
| INVT-03 | Phase 4 | Pending |
| METR-01 | Phase 5 | Pending |
| METR-02 | Phase 5 | Pending |
| METR-03 | Phase 5 | Pending |
| LOGS-01 | Phase 6 | Pending |
| LOGS-02 | Phase 6 | Pending |
| LOGS-03 | Phase 6 | Pending |
| LOGS-04 | Phase 6 | Pending |
| ACTN-01 | Phase 7 | Pending |
| ACTN-02 | Phase 7 | Pending |
| ACTN-03 | Phase 7 | Pending |
| ACTN-04 | Phase 7 | Pending |
| ACTN-05 | Phase 7 | Pending |
| ALRT-01 | Phase 8 | Pending |
| ALRT-02 | Phase 8 | Pending |
| ALRT-03 | Phase 8 | Pending |
| ALRT-04 | Phase 8 | Pending |
| ALRT-05 | Phase 8 | Pending |
| SECU-01 | Phase 2 | Pending |
| SECU-02 | Phase 1 | Pending |
| SECU-03 | Phase 3 | Pending |
| SECU-04 | Phase 7 | Pending |
| DEVX-01 | Phase 1 | Pending |
| DEVX-02 | Phase 1 | Pending |
| COMP-01 | Phase 1 | Pending |
| COMP-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after roadmap mapping*
