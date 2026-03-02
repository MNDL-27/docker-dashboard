# Roadmap: Docker Dashboard Cloud

## Overview

This roadmap delivers a secure outbound-agent Docker control plane in capability slices: preserve self-hosted continuity and local reproducibility first, then establish tenant/auth boundaries, then ship trusted fleet connectivity, observability, safe actions, and alerting. Each phase closes a user-visible loop that unblocks the next one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Dual-Mode Foundation and Local DX** - Keep self-hosted mode working while enabling reproducible local SaaS+agent workflows and secure transport defaults.
- [x] **Phase 2: Identity, Access, and Tenant Isolation** - Deliver accounts, organization/project boundaries, role assignment, and strict tenant-scoped access. (completed 2026-03-02)
- [ ] **Phase 3: Host Enrollment and Trusted Connectivity** - Establish one-time enrollment, durable agent credentials, heartbeat freshness, and protected ingest.
- [ ] **Phase 4: Fleet Inventory Views** - Deliver fleet and host container visibility with practical filtering and search.
- [ ] **Phase 5: Metrics Telemetry Core** - Provide live container metrics and bounded historical windows.
- [ ] **Phase 6: Live Logs and Retention** - Provide live tailing, stream controls, downloads, and bounded log retention behavior.
- [ ] **Phase 7: Safe Container Actions and Audit Trail** - Deliver role-guarded lifecycle actions, result tracking, monitor-only mode, and immutable action auditability.
- [ ] **Phase 8: Alerting and Notification Delivery** - Deliver baseline alert rules, deduplicated alert state transitions, and outbound notifications.

## Phase Details

### Phase 1: Dual-Mode Foundation and Local DX
**Goal**: Existing users and developers can run self-hosted and SaaS-local modes confidently with secure transport expectations.
**Depends on**: Nothing (first phase)
**Requirements**: COMP-01, COMP-02, DEVX-01, DEVX-02, SECU-02
**Success Criteria** (what must be TRUE):
  1. User can continue using the existing self-hosted dashboard mode after cloud components are introduced.
  2. Documentation clearly distinguishes self-hosted and SaaS operating modes and expected workflows.
  3. Developer can start cloud-api, cloud-web, data services, and a local agent with one documented command and complete seeded local setup.
  4. Production configuration accepts only HTTPS/WSS transport for UI/API/agent communication paths.
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md - Add deterministic one-command SaaS-local bootstrap with seeded setup while preserving self-hosted lane.
- [x] 01-02-PLAN.md - Enforce production HTTPS/WSS-only transport guardrails across API, web, and agent runtimes.
- [x] 01-03-PLAN.md - Split and clarify documentation for self-hosted vs SaaS-local modes with verification checklists.

### Phase 2: Identity, Access, and Tenant Isolation
**Goal**: Users can authenticate, collaborate, and operate within strict organization/project boundaries.
**Depends on**: Phase 1
**Requirements**: TEN-01, TEN-02, TEN-03, TEN-04, TEN-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, SECU-01
**Success Criteria** (what must be TRUE):
  1. User can create an account, log in, continue authenticated sessions, and log out cleanly.
  2. User can create an organization, create projects within it, and invite additional users.
  3. Owner/Admin can assign Owner/Admin/Operator/Viewer roles and members observe role-appropriate access.
  4. User can access only organizations and projects they belong to across all primary UI and API paths.
  5. Cross-tenant data access attempts are denied and out-of-scope tenant data is never visible.
**Plans**: 6 plans
Plans:
- [x] 02-01-PLAN.md - Harden account/session auth lifecycle and align web authentication flows.
- [x] 02-02-PLAN.md - Implement centralized organization/project scope enforcement and onboarding creation paths.
- [x] 02-03-PLAN.md - Deliver invitation and role-management API/UI with deterministic Owner/Admin policy controls.
- [x] 02-04-PLAN.md - Enforce fail-closed tenant isolation across core non-identity HTTP and ingest routes.
- [x] 02-05-PLAN.md - Harden remaining realtime/notification paths and add tenant-isolation regression tests.
- [x] 02-06-PLAN.md - Add shared dashboard shell logout flow to close AUTH-04 UX verification gap.

### Phase 3: Host Enrollment and Trusted Connectivity
**Goal**: Operators can enroll hosts through secure one-time bootstrap and trust fleet presence status.
**Depends on**: Phase 2
**Requirements**: ENRL-01, ENRL-02, ENRL-03, ENRL-04, ENRL-05, SECU-03
**Success Criteria** (what must be TRUE):
  1. User can create a host record, generate a one-time enrollment token, and copy an install snippet containing cloud URL and token.
  2. Platform exchanges valid first-connect enrollment tokens for durable agent credentials and rejects invalid/reused enrollment attempts.
  3. User can see online/offline host status and last-seen timestamps based on heartbeat freshness.
  4. Per-host API and ingest rate limits throttle abusive traffic while healthy hosts continue operating.
**Plans**: TBD

### Phase 4: Fleet Inventory Views
**Goal**: Users can inspect fleet composition and host-level container state quickly.
**Depends on**: Phase 3
**Requirements**: INVT-01, INVT-02, INVT-03
**Success Criteria** (what must be TRUE):
  1. User can view fleet-level host and container counts for their selected scope.
  2. User can view host container lists with status, image, labels, and restart count.
  3. User can filter and search host container lists to find target workloads quickly.
**Plans**: TBD

### Phase 5: Metrics Telemetry Core
**Goal**: Users can observe container health in real time with guaranteed short-history retention.
**Depends on**: Phase 4
**Requirements**: METR-01, METR-02, METR-03
**Success Criteria** (what must be TRUE):
  1. User can view live container metrics updates for CPU, memory, network, and restart indicators.
  2. User can switch between 15m, 1h, 6h, and 24h history windows and see recent metrics trends.
  3. Platform retains at least 24 hours of metrics samples for MVP querying.
**Plans**: TBD

### Phase 6: Live Logs and Retention
**Goal**: Users can follow and export container logs within bounded retention limits.
**Depends on**: Phase 5
**Requirements**: LOGS-01, LOGS-02, LOGS-03, LOGS-04
**Success Criteria** (what must be TRUE):
  1. User can view a live log tail for a selected container and pause/resume streaming without leaving context.
  2. User can download logs for a selected time range.
  3. Platform enforces bounded log retention so data outside retention windows is not returned.
**Plans**: TBD

### Phase 7: Safe Container Actions and Audit Trail
**Goal**: Authorized users can run guardrailed lifecycle actions with verifiable outcomes and immutable accountability.
**Depends on**: Phase 6
**Requirements**: ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05, SECU-04
**Success Criteria** (what must be TRUE):
  1. Operator-or-higher users can request start, stop, and restart actions and receive success/failure feedback with error details when available.
  2. Platform dispatches actions to the correct connected agent and users can observe action status progression to completion.
  3. Stop requests for protected containers are blocked unless initiated by Admin-or-higher users.
  4. Every action attempt is recorded in immutable audit entries with actor, target, timestamp, reason, and result, and monitor-only agents refuse execution requests.
**Plans**: TBD

### Phase 8: Alerting and Notification Delivery
**Goal**: Users can detect fleet issues early and receive actionable notifications through at least one channel.
**Depends on**: Phase 7
**Requirements**: ALRT-01, ALRT-02, ALRT-03, ALRT-04, ALRT-05
**Success Criteria** (what must be TRUE):
  1. User can create alert rules for container down duration, restart-loop thresholds, and sustained CPU/memory thresholds.
  2. Platform emits firing and resolved alert states with deduplication by rule and target.
  3. Platform delivers alert notifications through at least one configured channel (webhook or email).
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Dual-Mode Foundation and Local DX | 3/3 | Complete | 2026-03-02 |
| 2. Identity, Access, and Tenant Isolation | 6/6 | Complete   | 2026-03-02 |
| 3. Host Enrollment and Trusted Connectivity | 0/TBD | Not started | - |
| 4. Fleet Inventory Views | 0/TBD | Not started | - |
| 5. Metrics Telemetry Core | 0/TBD | Not started | - |
| 6. Live Logs and Retention | 0/TBD | Not started | - |
| 7. Safe Container Actions and Audit Trail | 0/TBD | Not started | - |
| 8. Alerting and Notification Delivery | 0/TBD | Not started | - |
