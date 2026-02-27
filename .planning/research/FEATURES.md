# Feature Research

**Domain:** Docker Monitoring SaaS
**Researched:** 2026-02-27
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Real-time container metrics** | CPU, memory, network, block I/O — core Docker stats API | LOW | Available via Docker stats API; standard Prometheus format |
| **Container list/fleet view** | See all containers across hosts in one place | LOW | List containers with status, image, created time |
| **Container logs (live streaming)** | Debugging containers requires seeing output | LOW | Stream logs via Docker API; need tail/filter |
| **Container actions** | Start/stop/restart are fundamental operations | LOW | Direct Docker API calls; requires audit |
| **Host enrollment/management** | Register Docker hosts to monitor | MEDIUM | Agent installation, secure registration flow |
| **Basic alerting** | Notify when container goes down or resource threshold exceeded | MEDIUM | Simple threshold-based rules; webhook notifications |
| **Multi-tenant isolation** | Org/projects/users with role-based access | MEDIUM | Tenant ID on all records; RBAC for actions |
| **User authentication** | Secure access to cloud dashboard | LOW | OAuth or email/password; session management |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Agent-based outbound connectivity** | No inbound firewall holes; simpler customer setup | HIGH | WebSocket tunnel; self-hosted agent; unique positioning |
| **Multi-host aggregate view** | See fleet health across many Docker hosts | MEDIUM | Group containers by host/project/org |
| **Container restart loop detection** | Identify unstable containers quickly | MEDIUM | Track restart count over time window |
| **Protected containers policy** | Prevent accidental stopping of critical containers | LOW | Tag-based or explicit list; block stop actions |
| **Audit logging for actions** | Compliance and incident investigation | MEDIUM | Log who did what and when; immutable |
| **Basic alert routing** | Route alerts to different channels per environment | MEDIUM | Webhook/PagerDuty/Slack integration |
| **Simple dashboard** | At-a-glance health view | LOW | Host count, container count, alert summary |
| **Container resource history** | See past resource usage for capacity planning | HIGH | Time-series metrics storage; retention planning |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full log search/indexing** | Want to search across all container logs | Extremely expensive at scale; complexity explosion | Basic tail/download; defer full-text search |
| **Kubernetes support** | "Just add K8s" request | Fundamentally different architecture; much larger scope | Explicitly exclude for MVP; roadmap separately |
| **Real-time metric charts at 1s** | Want sub-second granularity | Storage/processing cost; usually unnecessary | 5-10s granularity sufficient for most |
| **Full container management UI** | Create/edit/delete images, volumes, networks | Scope creep; many edge cases; self-hosted can do this | Focus on monitoring + actions only |
| **Custom metrics dashboards** | Want to build own dashboards | Complexity; maintenance burden | Pre-built dashboards sufficient for MVP |
| **Multi-region support** | Global customers need it | Operational complexity; unnecessary at start | Single region MVP |
| **Billing/payments integration** | Monetization need | Separate concern; can be added later | Manual billing or Stripe later |

## Feature Dependencies

```
User Authentication
    └──requires──> Multi-tenant Isolation

Host Enrollment
    └──requires──> Agent Installation Flow
    └──requires──> User Authentication

Fleet View
    └──requires──> Host Enrollment

Container Metrics
    └──requires──> Host Enrollment
    └──requires──> Agent Connectivity (WebSocket)

Container Logs
    └──requires──> Host Enrollment
    └──requires──> Agent Connectivity (WebSocket)

Container Actions
    └──requires──> Fleet View
    └──requires──> Audit Logging

Basic Alerts
    └──requires──> Container Metrics
    └──requires──> User Authentication (for notification routing)
```

### Dependency Notes

- **User Authentication requires Multi-tenant Isolation:** Cannot have secure SaaS without tenant isolation; both needed early.
- **Fleet View requires Host Enrollment:** Can't show fleet without registered hosts.
- **Container Metrics requires Agent Connectivity:** Agent must stream metrics to cloud via WebSocket.
- **Container Actions requires Audit Logging:** Every action must be logged for compliance.
- **Basic Alerts requires Container Metrics:** Can't alert without data to alert on.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] Real-time container metrics — via Docker stats API, displayed in UI
- [x] Container list/fleet view — list all containers across registered hosts
- [x] Container logs (live streaming) — tail logs from selected container
- [x] Container actions — start/stop/restart with confirmation
- [x] Host enrollment — agent installation + registration to cloud
- [x] User authentication — email/password login to cloud dashboard
- [x] Multi-tenant isolation — org/project separation
- [x] Basic alerts — container down + restart loop detection
- [x] Audit logging — track who performed actions

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Protected containers policy — prevent accidental stops
- [ ] Alert routing — Slack/email/PagerDuty webhooks
- [ ] Simple dashboard — aggregate health view
- [ ] Container resource history — 24h retention for metrics

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Full log search/indexing
- [ ] Kubernetes support
- [ ] Custom dashboards
- [ ] Billing/payments
- [ ] Multi-region

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real-time container metrics | HIGH | LOW | P1 |
| Container list/fleet view | HIGH | LOW | P1 |
| Container logs (live) | HIGH | LOW | P1 |
| Container actions | HIGH | LOW | P1 |
| Host enrollment | HIGH | MEDIUM | P1 |
| User authentication | HIGH | LOW | P1 |
| Multi-tenant isolation | HIGH | MEDIUM | P1 |
| Basic alerts | HIGH | MEDIUM | P1 |
| Audit logging | MEDIUM | MEDIUM | P1 |
| Protected containers | MEDIUM | LOW | P2 |
| Alert routing | MEDIUM | MEDIUM | P2 |
| Simple dashboard | MEDIUM | LOW | P2 |
| Resource history | MEDIUM | HIGH | P2 |
| Full log search | HIGH | HIGH | P3 |
| K8s support | HIGH | HIGH | P3 |
| Custom dashboards | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Datadog | Grafana Cloud | Portainer | Our Approach |
|---------|---------|---------------|-----------|--------------|
| Real-time metrics | ✅ Full | ✅ Via Alloy | ✅ Basic | ✅ MVP - Docker stats API |
| Log streaming | ✅ Full | ✅ Loki | ✅ Basic | ✅ MVP - Tail only |
| Log search/indexing | ✅ Paid add-on | ✅ Paid add-on | ❌ | ❌ Deferred - too expensive |
| Container actions | ✅ Via API | ❌ | ✅ Full | ✅ MVP - Start/stop/restart |
| Agent connectivity | ✅ Agent | ✅ Alloy (self-host) | ✅ Agent | ✅ Agent (outbound WebSocket) |
| Outbound-only agent | ❌ | ❌ | ❌ | ✅ Unique differentiator |
| Multi-tenant SaaS | ✅ Full | ✅ Full | ⚠️ Limited | ✅ MVP |
| Alerting | ✅ Full | ✅ Via Alertmanager | ⚠️ Basic | ✅ MVP - Basic thresholds |
| RBAC | ✅ Full | ✅ Limited | ⚠️ Limited | ✅ MVP - Operator/Admin |
| K8s support | ✅ Full | ✅ Full | ✅ Full | ❌ Deferred |

## Sources

- Datadog container monitoring documentation (2025-2026)
- Grafana Cloud Docker monitoring with Alloy (2025-2026)
- Portainer container management features (2025-2026)
- Middleware.io "10 Best Container Monitoring Tools" (2026)
- Better Stack community comparison (2025)
- Docker official runtime metrics documentation
- Competitor feature analysis from product pages

---

*Feature research for: Docker Monitoring SaaS*
*Researched: 2026-02-27*
