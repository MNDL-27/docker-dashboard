# Feature Research

**Domain:** Hosted Docker fleet monitoring and control (SaaS control plane + host agents)
**Researched:** 2026-03-01
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Secure host enrollment + durable agent heartbeat | Modern fleet tools use agent/edge onboarding instead of exposing host APIs directly | HIGH | Found in Portainer Edge Agent model (standard + async) and Datadog Docker Agent model; requires token lifecycle, credential rotation, and reconnect behavior |
| Fleet inventory (org/project/host/container) with strong filtering | Operators need one pane to answer "what is running where" | MEDIUM | Container explorer/inventory UX is baseline in Portainer and Datadog Containers Explorer |
| Container detail with lifecycle state + config + quick actions | Day-2 ops requires inspecting and acting without SSH | MEDIUM | Portainer exposes container status/details and start/stop/remove actions directly in UI |
| Live metrics plus short historical context | Real-time alone is not enough; users need immediate + recent trend context | HIGH | Datadog shows high-frequency live data and historical views; implement low-latency stream + bounded rollups |
| Live log tail + basic search/filter + download | Users expect `docker logs -f` equivalent in web UI for triage | MEDIUM | Portainer provides in-view search/filter/download; Datadog documents streaming vs indexed distinction |
| Alerting with notification routing and noise controls | Monitoring without actionable notifications is considered incomplete | MEDIUM | Datadog monitors and New Relic NRQL alerts both emphasize thresholding, routing, and noise reduction controls |
| RBAC and tenancy boundaries | Multi-tenant SaaS requires explicit role and scope enforcement | HIGH | Portainer and Datadog both document role/access controls; this is mandatory for hosted control planes |
| Audit trail for user and API actions | Control products are expected to answer "who changed what, when" | MEDIUM | Datadog Audit Trail product shows strong market expectation for governance/compliance logging |
| Host/agent health visibility (online/offline, stale data) | Fleet trust depends on knowing data freshness and agent state | MEDIUM | New Relic and Datadog both support loss-of-signal style alerting patterns; treat stale agents as first-class signal |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bandwidth-aware agent modes (live tunnel vs async snapshot/command) | Enables remote/unstable sites without sacrificing operability | HIGH | Portainer Edge Async demonstrates demand for low-bandwidth polling and snapshot-based control |
| Correlated incident timeline (actions + logs + metrics + alerts in one thread) | Cuts MTTR by removing manual correlation across tabs/tools | MEDIUM | Competitors split this across products; integrate natively around container actions and alerts |
| Guardrailed control actions (scoped permissions, optional approvals, blast-radius limits) | Safer remote control for production fleets; reduces operator risk | HIGH | Builds on RBAC + audit table stakes; start with policy checks before adding multi-step approvals |
| Opinionated "Docker health packs" (preset alerts/dashboards by workload type) | Faster time-to-value for small teams that do not want to handcraft monitors | MEDIUM | Inspired by monitor templates/common alert recipes in observability platforms |
| Cost-aware telemetry controls per project (retention caps, sampling, opt-in indexing later) | Predictable spend and easier SaaS unit economics | MEDIUM | Aligns with bounded-retention MVP and avoids early observability-cost blowups |
| Seamless dual-mode operation (cloud-managed + existing self-hosted continuity) | Low-friction migration for current users and less adoption risk | HIGH | Strategic differentiator specific to this project context, not common in greenfield competitors |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full-text log indexing/search in MVP | "Need grep-like search across everything" | Expensive ingest/storage pipeline, relevance tuning, retention/legal complexity; derails core control-plane value | Keep bounded live tail + download now; add selective indexing only after validated demand |
| Kubernetes support in MVP | "One dashboard for all runtimes" | Massive scope expansion (control loops, object model, auth, network assumptions) and product identity drift | Stay Docker-first; design data model with future runtime extensibility but no k8s UI/control now |
| Full Docker object management (images/volumes/networks/secrets) | "Portainer parity from day one" | Broadens blast radius and permissions model before core workflows are solid | Limit MVP actions to container lifecycle + safe read-only details |
| Arbitrary remote command execution / host shell | "Power users want SSH replacement" | High security/compliance risk and abuse potential in multi-tenant SaaS | Keep constrained, auditable action catalog; add approved runbooks later if needed |
| Inbound control channels to customer hosts | "Lower latency and simpler command path" | Breaks key outbound-only security/deployment advantage | Preserve outbound-only agent with polling/tunnel pattern |
| Unbounded telemetry retention by default | "Never lose data" | Quickly destroys margins and creates unbounded liability surface | Default bounded retention, explicit paid retention tiers, and archival integration later |

## Feature Dependencies

```text
[Tenancy model (org/project/user)]
    └──requires──> [RBAC + permission checks]
                         └──requires──> [Audit trail schema]
                                             └──enables──> [Safe container actions]

[Host enrollment + agent identity]
    └──requires──> [Durable heartbeat/session model]
                         ├──enables──> [Fleet inventory freshness]
                         ├──enables──> [Live metrics stream]
                         └──enables──> [Live log tail]

[Metrics + logs ingestion]
    └──requires──> [Storage/retention policy]
                         └──enables──> [Alert evaluation]

[Alerting]
    └──requires──> [Notification routing + contact points]

[Guardrailed control actions]
    └──enhances──> [RBAC + audit trail]

[Full-text indexing]
    └──conflicts──> [Bounded-cost MVP]

[Kubernetes support]
    └──conflicts──> [Docker-first MVP timeline]
```

### Dependency Notes

- **Safe actions require RBAC and audit first:** executing remote start/stop/restart without permission + traceability creates immediate trust and compliance risk.
- **Enrollment quality drives everything else:** weak identity/session semantics become data-quality issues in inventory, metrics, logs, and alerts.
- **Alerting is downstream of telemetry correctness:** noisy or delayed streams create false alarms and alert fatigue; evaluate this after ingest stability.
- **Cost controls must precede feature expansion:** without bounded retention/sampling, logs+metrics become the dominant operational risk before PMF.

## MVP Definition

### Launch With (v1)

Minimum viable product — what is needed to validate the concept.

- [ ] Multi-tenant tenancy + RBAC (Owner/Admin/Operator/Viewer) — essential trust and governance baseline
- [ ] Secure host enrollment + outbound-only durable agent connectivity — required for real fleet adoption
- [ ] Fleet/host/container inventory views with health state — core visibility workflow
- [ ] Live metrics + short history for CPU/memory/network/restarts — core observability loop
- [ ] Live logs (bounded retention) + download + basic filtering — day-2 debugging baseline
- [ ] Safe container start/stop/restart + action audit history — core control value proposition
- [ ] Basic alerts (resource/uptime) + email/webhook notifications — proactive operations baseline

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Bandwidth-aware async mode controls and tuning — add when low-connectivity customers appear
- [ ] Alert packs + suggested thresholds by workload type — add after seeing repetitive manual setup patterns
- [ ] Correlated incident timeline view — add once telemetry and action events are stable and trusted
- [ ] Agent fleet management controls (remote config/rings) — add after >50-100 host deployments per customer

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Selective log indexing/search tiers — add only with validated willingness-to-pay for deep log analytics
- [ ] Expanded Docker object management (images/volumes/networks) — add after container lifecycle workflows are mature
- [ ] Kubernetes support — only after Docker-first segment is saturated and roadmap supports a parallel product track

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Host enrollment + heartbeat | HIGH | HIGH | P1 |
| Tenancy + RBAC | HIGH | HIGH | P1 |
| Fleet inventory + container detail | HIGH | MEDIUM | P1 |
| Live metrics + short history | HIGH | HIGH | P1 |
| Live logs + download | HIGH | MEDIUM | P1 |
| Start/stop/restart + audit | HIGH | MEDIUM | P1 |
| Basic alerting + notification routing | HIGH | MEDIUM | P1 |
| Correlated incident timeline | MEDIUM | MEDIUM | P2 |
| Bandwidth-aware async mode optimization | MEDIUM | HIGH | P2 |
| Alert packs/recommendations | MEDIUM | MEDIUM | P2 |
| Full-text log indexing | MEDIUM | HIGH | P3 |
| Kubernetes support | LOW (for MVP segment) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have after launch signal
- P3: Defer until clear demand

## Competitor Feature Analysis

| Feature | Portainer | Datadog | New Relic | Our Approach |
|---------|-----------|---------|-----------|--------------|
| Agent/edge enrollment | Edge Agent standard + async modes for remote environments | Docker Agent deployment per host | Infra/log agents + API ingestion patterns | Outbound-only host agent with simple enrollment token flow |
| Fleet/container explorer | Strong Docker environment + container management UI | Containers Explorer with real-time table and tags | Infrastructure + query-driven views | Opinionated fleet + host + container drill-down for Docker operations |
| Live metrics | Container stats and refresh-based views | 2s live metrics with historical views | NRQL-driven infra metrics and alerts | Live-first metrics with bounded historical rollups |
| Logs | Container logs with search/filter/download | Live tail + optional indexed retention model | Log API + log management pipeline | Bounded live logs and download first; indexing deferred |
| Alerts | Available via broader platform features | Monitor platform + templates + routing | NRQL alerts + signal-loss controls | Basic high-signal Docker health alerts first |
| RBAC/audit | Access control on resources | RBAC + separate Audit Trail capability | User management and policy controls | RBAC and action audit as core, not add-on |
| Control actions | Container lifecycle actions directly in UI | Primarily observability and automation workflows | Primarily observability and alert workflows | Safe lifecycle control as first-class product feature |

## Sources

- Portainer docs (official): Docker environment onboarding, Edge Agent standard/async, access control, container details/logs/stats/actions  
  - https://docs.portainer.io/admin/environments/add/docker  
  - https://docs.portainer.io/admin/environments/add/docker/edge  
  - https://docs.portainer.io/admin/environments/add/docker/edge-async  
  - https://docs.portainer.io/advanced/access-control  
  - https://docs.portainer.io/user/docker/containers  
  - https://docs.portainer.io/user/docker/containers/view  
  - https://docs.portainer.io/user/docker/containers/logs  
  - https://docs.portainer.io/user/docker/containers/stats
- Datadog docs (official): Docker Agent, container explorer/live logs, monitors, RBAC, audit trail  
  - https://docs.datadoghq.com/containers/docker.md  
  - https://docs.datadoghq.com/containers/docker/log.md  
  - https://docs.datadoghq.com/containers/monitoring/containers_explorer.md  
  - https://docs.datadoghq.com/monitors.md  
  - https://docs.datadoghq.com/account_management/rbac.md  
  - https://docs.datadoghq.com/account_management/audit_trail.md
- New Relic docs (official): log ingestion constraints and NRQL alert/signal-loss patterns  
  - https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/  
  - https://docs.newrelic.com/docs/alerts/create-alert/create-alert-condition/create-nrql-alert-conditions/

### Confidence notes

- **HIGH confidence:** table-stakes around agent onboarding, inventory, metrics/logs, RBAC, and alerting patterns (multiple official docs agree).
- **MEDIUM confidence:** differentiator prioritization (opinionated synthesis from official feature sets + project constraints).
- **LOW confidence:** none used as authoritative claims; where evidence was weak, recommendations were framed as strategy rather than fact.

---
*Feature research for: Docker Dashboard Cloud*
*Researched: 2026-03-01*
