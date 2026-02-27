# Pitfalls Research

**Domain:** Docker Monitoring SaaS (Agent-based multi-tenant container observability platform)
**Researched:** 2026-02-27
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: High Cardinality Metrics Explosion

**What goes wrong:**
Metrics cardinality grows exponentially with container labels, causing Prometheus/storage to run out of memory or become prohibitively expensive. A single metric with labels like `container_name`, `image`, `status_code`, `user_id` can create millions of time series.

**Why it happens:**
- Adding granular labels to every metric "for better debugging" without understanding cardinality impact
- Each unique combination of label values = new time series
- Container names, IDs, and short-lived container patterns amplify this

**How to avoid:**
- Define strict label allowlists; reject dynamic labels like container_id, pod_name
- Use metric relabeling in the agent to drop high-cardinality labels before sending
- Implement cardinality limits per tenant with hard caps and alerts

**Warning signs:**
 memory usage- Prometheus growing >50% month-over-month
- Storage costs exceeding 2x expected growth
- Query latency spikes on dashboards

**Phase to address:** Phase 1: Core Infrastructure

---

### Pitfall 2: Agent Connectivity Reliability (WebSocket/Outbound)

**What goes wrong:**
Agents deployed on customer hosts lose connectivity, causing data gaps, duplicate metrics, or "zombie agents" that appear online but aren't reporting.

**Why it happens:**
- NAT/firewall issues breaking long-lived WebSocket connections
- Customer networks blocking outbound connections or having restrictive proxies
- No graceful reconnection with backoff causing connection storms

**How to avoid:**
- Implement agent heartbeat with configurable intervals (30s default)
- Use exponential backoff with jitter on reconnection (max 5min)
- Build agent "last seen" tracking in DB with staleness detection
- Support HTTP long-polling fallback for restricted networks

**Warning signs:**
- Agents showing "online" but no recent metrics (check last_seen timestamps)
- Sudden drops in metric volume from specific regions/providers
- Customer reports "it stopped working overnight"

**Phase to address:** Phase 1: Core Infrastructure + Phase 2: Agent Deployment

---

### Pitfall 3: Docker Daemon Permission/Access Model

**What goes wrong:**
The agent cannot access Docker stats API due to socket permissions, or worse—agent compromise gives customer root access to their Docker host.

**Why it happens:**
- Running agent without proper docker group or root access
- Exposing docker.sock to agent container (security risk)
- Agent having more permissions than needed (principle of least privilege violated)

**How to avoid:**
- Document minimum required permissions clearly (read-only docker stats API access)
- Provide systemd service installation for direct daemon access vs containerized agent
- Consider read-only API mode where Docker daemon supports it
- Never mount docker.sock into agent container in production

**Warning signs:**
- Agent logs showing "permission denied" for docker stats API
- Customer security teams rejecting installation due to docker.sock requirement
- Agent process running as root when it shouldn't need to

**Phase to address:** Phase 1: Core Infrastructure + Phase 2: Agent Deployment

---

### Pitfall 4: Ephemeral Container Data Loss

**What goes wrong:**
Missing metrics because containers started/died between scrape intervals, or losing historical context when containers are replaced (common in compose/swarm environments).

**Why it happens:**
- Polling-based metrics missing transient containers
- Container IDs changing on restart losing historical correlation
- Not capturing container start/stop events

**How to avoid:**
- Implement event-based metric collection (Docker events API) alongside polling
- Use container labels/metadata for stable identity across restarts
- Store container metadata separately from metrics for historical lookup
- Scrape more frequently for critical metrics (15s instead of 60s)

**Warning signs:**
- "Flapping" container appearances in UI
- Users complaining "my container was running but showed as down"
- No historical data for short-lived containers

**Phase to address:** Phase 1: Core Infrastructure

---

### Pitfall 5: Multi-Tenant Data Isolation Leakage

**What goes wrong:**
Tenant A sees Tenant B's data, or one tenant's bad query causes performance degradation for all tenants.

**Why it happens:**
- Shared database connections without tenant filtering
- Caching layer without tenant keys (redis keys bleeding between tenants)
- Query pipeline (Prometheus remote write) not implementing tenant isolation

**How to avoid:**
- Implement tenant_id as first-class concept in data model from day one
- Use tenant-scoped Redis keys: `metrics:{tenant_id}:{...}`
- Consider separate time-series databases per tenant for strict isolation
- Build tenant context propagation through entire request lifecycle

**Warning signs:**
- Customer support tickets: "I see another customer's containers"
- One tenant's heavy query slowing down entire system
- Data appearing in wrong tenant dashboards

**Phase to address:** Phase 1: Core Infrastructure (MUST be designed in from start)

---

## Moderate Pitfalls

### Pitfall 6: Alert Fatigue from Poor Alert Design

**What goes wrong:**
Users receive hundreds of alerts per day, leading to ignored warnings and missed critical issues.

**Why it happens:**
- Default alert thresholds too aggressive
- No alert deduplication or grouping
- Alerting on every metric instead of meaningful SLOs

**How to avoid:**
- Implement alert routing with escalation policies
- Use SLO-based alerting (error budgets) rather than threshold alerts
- Build alert customization per project/team
- Add "quiet hours" and notification preferences

**Warning signs:**
- Customers disabling all alerts
- Alert acknowledgment rates <20%
- "Too many notifications" in NPS comments

**Phase to address:** Phase 3: Alerting & Notifications

---

### Pitfall 7: Log Volume Cost Explosion

**What goes wrong:**
Log ingestion costs 10x expectations because containers produce massive stdout/stderr, especially in development environments.

**Why it happens:**
- Capturing all container logs by default
- No log sampling or aggregation
- Customers don't configure log limits

**How to avoid:**
- Implement tiered logging: error/warn by default, debug on-demand
- Add per-container log rate limiting in agent
- Provide log retention policies with automatic cleanup
- Make log ingestion opt-in with clear cost implications

**Warning signs:**
- Log storage growing 10x month-over-month
- Customers surprised by "logs are extra" pricing
- Agent disk usage spikes due to log buffering

**Phase to address:** Phase 3: Logs & Events

---

### Pitfall 8: Inadequate RBAC for Docker Resources

**What goes wrong:**
Users can see/manage containers they shouldn't have access to, or admins can't restrict access to specific hosts/projects.

**Why it happens:**
- RBAC model too coarse (only org-level, no project/host restrictions)
- Not modeling Docker-specific hierarchy: Org → Project → Host → Container
- Missing permission inheritance from parent to child resources

**How to avoid:**
- Design RBAC for Docker hierarchy: Org → Projects → Hosts → Containers
- Implement attribute-based access control (ABAC) for container filtering
- Add host-level access restrictions (user can see only assigned hosts)
- Build audit logging for all permission decisions

**Warning signs:**
- Users seeing containers from other teams/projects
- Cannot restrict user to specific host(s)
- Permission changes don't take effect immediately

**Phase to address:** Phase 2: Multi-tenant & RBAC

---

### Pitfall 9: Preserving Self-Hosted Mode Complexity

**What goes wrong:**
Cloud-first architecture makes self-hosted mode extremely difficult, doubling development and support effort.

**Why it happens:**
- Tight coupling between agent and cloud APIs
- Cloud-specific assumptions baked into agent (e.g., always-connect-to-cloud)
- Shared database schema not compatible with self-hosted isolation

**How to avoid:**
- Design agent to work standalone (local storage, local UI)
- Abstract cloud connection as optional plugin
- Create clear "cloud vs self-hosted" feature matrix early
- Build agent config for "offline mode" from day one

**Warning signs:**
- Self-hosted feature requests requiring major refactoring
- Agent failing when network unavailable
- Two separate codebases emerging for cloud vs self-hosted

**Phase to address:** Phase 1: Core Infrastructure (architect for both modes)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip tenant_id on internal metrics | Faster initial development | Impossible to bill per-tenant or isolate issues | Never - add from day one |
| Single Redis instance for all tenants | Simpler ops | No isolation, noisy neighbor problems | Only for early MVP (<100 tenants) |
| Poll Docker API every 60s | Reduced agent CPU | Miss short-lived containers, poor UX | Never - use 15s or event-based |
| Store raw logs in Postgres | Easy to query | Storage costs 10x vs specialized storage | Never - use object storage + search index |
| WebSocket without TLS initially | Simpler dev setup | Security vulnerability, rejected by prod | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Docker Stats API | Assuming API always available | Handle daemon restart, API version mismatches |
| Prometheus Remote Write | Not handling backpressure | Implement client-side buffering with disk fallback |
| WebSocket | No heartbeat, connections die silently | Ping/pong every 30s, detect stale connections |
| Customer VPN/proxy | Assuming direct internet | Support HTTP CONNECT proxy, provide connectivity checks |
| TLS certificates | Ignoring cert expiration | Auto-renewal, warn 30 days before expiry |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-container query | Dashboard loads in 30s+ | Aggregate metrics in agent, pre-compute | At 100+ containers per host |
| Real-time log streaming | WebSocket memory pressure | Buffer logs client-side, batch sends | At 50+ MB/s log volume |
| Full-text log search | Queries timeout | Use dedicated search (Elasticsearch/OpenSearch), index only metadata | At 1GB+ logs/day |
| Wide time ranges | Query memory explosion | Limit query window, enforce pagination | At 30+ day queries |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Agent running as root | Container escape gives host access | Run agent as dedicated user with minimal privileges |
| No encryption in transit | MITM attack intercepts metrics | TLS 1.3 mandatory for all agent-cloud communication |
| Storing Docker socket path in plain text | Credential theft | Use secrets management, environment variables |
| No audit logging for actions | Compliance failure, 无法追踪 | Log all container actions with user/tenant context |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing container IDs | Unreadable, users can't identify containers | Always show container name (user-friendly) as primary |
| No "copy log line" | Debugging painful | Add one-click copy for log lines |
| Alert emails with no context | "Container down" - which one? | Include host, project, container name in all alerts |
| Dashboard requiring 50+ queries | Slow, frustrating | Pre-aggregate, cache, use materialized views |

---

## "Looks Done But Isn't" Checklist

- [ ] **Agent auto-update:** Often missing — need secure update mechanism, rollback support
- [ ] **Container restart:** Often missing container restart action — need daemon API access
- [ ] **Historical comparison:** Often missing — "vs yesterday" requires stored baseline data
- [ ] **Log retention policies:** Often missing — need per-tenant configurable retention
- [ ] **Outbound proxy support:** Often missing — many customers require proxy for agent connectivity

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cardinality explosion | HIGH | Identify top cardinality sources, implement relabeling, potentially migrate to new Prometheus instance |
| Agent connectivity loss | MEDIUM | Deploy connectivity check tool, provide fallback connection method |
| Data isolation breach | CRITICAL | Audit all access logs, notify affected tenants, implement stricter isolation |
| Log cost overrun | MEDIUM | Implement sampling, adjust retention, provide cost estimation UI |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| High Cardinality | Phase 1: Core Infrastructure | Monitor Prometheus cardinality dashboard; alert on >1M series |
| Agent Connectivity | Phase 1: Core + Phase 2 | Connection stability tests; simulate network failures |
| Docker Permissions | Phase 1: Core + Phase 2 | Installation docs; test on clean Ubuntu/DEB |
| Ephemeral Data Loss | Phase 1: Core | Verify metrics for short-lived test containers |
| Multi-Tenant Isolation | Phase 1: Core | Security review; cross-tenant query tests |
| Alert Fatigue | Phase 3: Alerting | User survey on alert volume; adjust defaults |
| Log Costs | Phase 3: Logs | Cost per-tenant dashboard; test with high-volume logs |
| RBAC Gaps | Phase 2: Multi-tenant | Test all permission combinations |
| Self-hosted Mode | Phase 1: Core | Run agent in offline mode for 1 week |

---

## Sources

- Grafana: "How to manage high cardinality metrics in Prometheus and Kubernetes" (2022)
- OneUptime: "How to Implement Multi-Tenant Observability Pipelines" (2026)
- OneUptime: "How to Configure Docker Containers for WebSocket Connections" (2026)
- Docker Docs: "Protect the Docker daemon socket"
- Aqua Security: "Docker Container Security Guide" (2021)
- Sysdig: "Cloud-Native Security Report" (2024)
- Last9: "Troubleshooting Common Prometheus Issues" (2023)
- Fivenines: "High Cardinality Metrics Are Breaking Your Monitoring Budget" (2024)
- InfoQ: "Things SaaS Builders Keep Getting Wrong" (2025)
- Datadog: "Enterprise Deployments That Don't Destroy Your Budget" (2025)

---

*Pitfalls research for: Docker Monitoring SaaS*
*Researched: 2026-02-27*
