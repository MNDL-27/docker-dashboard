// Mock data for Docker Dashboard SaaS

export const currentUser = {
  id: "usr_1",
  name: "Sarah Chen",
  email: "sarah@acmecloud.io",
  avatar: "SC",
  role: "owner" as const,
};

export const organizations = [
  { id: "org_1", name: "Acme Cloud", slug: "acme-cloud", plan: "team" as const, members: 12, hosts: 24, containers: 187 },
  { id: "org_2", name: "DevStack Inc", slug: "devstack", plan: "pro" as const, members: 4, hosts: 8, containers: 45 },
];

export const projects = [
  { id: "proj_1", name: "Production Cluster", orgId: "org_1", env: "production", hosts: 12, containers: 98 },
  { id: "proj_2", name: "Staging Environment", orgId: "org_1", env: "staging", hosts: 6, containers: 45 },
  { id: "proj_3", name: "Dev Sandbox", orgId: "org_1", env: "development", hosts: 6, containers: 44 },
];

export type HostStatus = "healthy" | "warning" | "critical" | "offline";

export const hosts = [
  { id: "h_1", name: "prod-web-01", ip: "10.0.1.10", status: "healthy" as HostStatus, os: "Ubuntu 22.04", dockerVersion: "24.0.7", region: "us-east-1", cpu: 34, memory: 62, containers: 12, lastSeen: "2s ago", agentVersion: "1.4.2" },
  { id: "h_2", name: "prod-web-02", ip: "10.0.1.11", status: "healthy" as HostStatus, os: "Ubuntu 22.04", dockerVersion: "24.0.7", region: "us-east-1", cpu: 28, memory: 55, containers: 11, lastSeen: "1s ago", agentVersion: "1.4.2" },
  { id: "h_3", name: "prod-api-01", ip: "10.0.2.10", status: "warning" as HostStatus, os: "Debian 12", dockerVersion: "24.0.6", region: "us-east-1", cpu: 78, memory: 82, containers: 15, lastSeen: "5s ago", agentVersion: "1.4.1" },
  { id: "h_4", name: "prod-worker-01", ip: "10.0.3.10", status: "healthy" as HostStatus, os: "Ubuntu 22.04", dockerVersion: "24.0.7", region: "us-west-2", cpu: 45, memory: 58, containers: 8, lastSeen: "3s ago", agentVersion: "1.4.2" },
  { id: "h_5", name: "prod-db-01", ip: "10.0.4.10", status: "healthy" as HostStatus, os: "Ubuntu 22.04", dockerVersion: "24.0.7", region: "us-west-2", cpu: 52, memory: 71, containers: 4, lastSeen: "1s ago", agentVersion: "1.4.2" },
  { id: "h_6", name: "staging-web-01", ip: "10.1.1.10", status: "healthy" as HostStatus, os: "Ubuntu 22.04", dockerVersion: "24.0.7", region: "eu-west-1", cpu: 12, memory: 34, containers: 9, lastSeen: "2s ago", agentVersion: "1.4.2" },
  { id: "h_7", name: "staging-api-01", ip: "10.1.2.10", status: "healthy" as HostStatus, os: "Debian 12", dockerVersion: "24.0.6", region: "eu-west-1", cpu: 18, memory: 41, containers: 7, lastSeen: "4s ago", agentVersion: "1.4.1" },
  { id: "h_8", name: "dev-sandbox-01", ip: "10.2.1.10", status: "offline" as HostStatus, os: "Ubuntu 20.04", dockerVersion: "23.0.6", region: "us-east-1", cpu: 0, memory: 0, containers: 0, lastSeen: "3h ago", agentVersion: "1.3.8" },
];

export type ContainerStatus = "running" | "exited" | "paused" | "restarting" | "unhealthy";

export const containers = [
  { id: "c_1", name: "nginx-proxy", image: "nginx:1.25-alpine", hostId: "h_1", hostName: "prod-web-01", status: "running" as ContainerStatus, cpu: 2.1, memory: 128, uptime: "14d 6h", ports: "80:80, 443:443", restarts: 0 },
  { id: "c_2", name: "app-frontend", image: "acme/frontend:v2.14.3", hostId: "h_1", hostName: "prod-web-01", status: "running" as ContainerStatus, cpu: 8.4, memory: 512, uptime: "7d 2h", ports: "3000:3000", restarts: 0 },
  { id: "c_3", name: "api-gateway", image: "acme/api:v3.8.1", hostId: "h_3", hostName: "prod-api-01", status: "running" as ContainerStatus, cpu: 34.2, memory: 1024, uptime: "7d 2h", ports: "8080:8080", restarts: 2 },
  { id: "c_4", name: "auth-service", image: "acme/auth:v1.12.0", hostId: "h_3", hostName: "prod-api-01", status: "unhealthy" as ContainerStatus, cpu: 45.1, memory: 768, uptime: "1d 4h", ports: "8081:8081", restarts: 8 },
  { id: "c_5", name: "worker-queue", image: "acme/worker:v2.3.0", hostId: "h_4", hostName: "prod-worker-01", status: "running" as ContainerStatus, cpu: 22.5, memory: 384, uptime: "14d 6h", ports: "", restarts: 0 },
  { id: "c_6", name: "redis-cache", image: "redis:7.2-alpine", hostId: "h_3", hostName: "prod-api-01", status: "running" as ContainerStatus, cpu: 5.3, memory: 256, uptime: "30d 1h", ports: "6379:6379", restarts: 0 },
  { id: "c_7", name: "postgres-primary", image: "postgres:16.1", hostId: "h_5", hostName: "prod-db-01", status: "running" as ContainerStatus, cpu: 18.7, memory: 2048, uptime: "45d 3h", ports: "5432:5432", restarts: 0 },
  { id: "c_8", name: "metrics-collector", image: "prom/prometheus:v2.48", hostId: "h_1", hostName: "prod-web-01", status: "running" as ContainerStatus, cpu: 3.2, memory: 384, uptime: "14d 6h", ports: "9090:9090", restarts: 0 },
  { id: "c_9", name: "log-shipper", image: "fluent/fluentd:v1.16", hostId: "h_1", hostName: "prod-web-01", status: "restarting" as ContainerStatus, cpu: 0, memory: 64, uptime: "0h 2m", ports: "", restarts: 15 },
  { id: "c_10", name: "cron-scheduler", image: "acme/cron:v1.5.2", hostId: "h_4", hostName: "prod-worker-01", status: "running" as ContainerStatus, cpu: 1.1, memory: 128, uptime: "14d 6h", ports: "", restarts: 0 },
  { id: "c_11", name: "notification-svc", image: "acme/notify:v2.1.0", hostId: "h_3", hostName: "prod-api-01", status: "exited" as ContainerStatus, cpu: 0, memory: 0, uptime: "—", ports: "8082:8082", restarts: 3 },
  { id: "c_12", name: "staging-app", image: "acme/frontend:v2.15.0-rc1", hostId: "h_6", hostName: "staging-web-01", status: "running" as ContainerStatus, cpu: 4.2, memory: 256, uptime: "2d 8h", ports: "3000:3000", restarts: 0 },
];

export const alerts = [
  { id: "a_1", title: "High CPU on prod-api-01", severity: "warning" as const, host: "prod-api-01", container: "api-gateway", rule: "CPU > 75%", triggeredAt: "12 min ago", status: "firing" as const },
  { id: "a_2", title: "Container unhealthy: auth-service", severity: "critical" as const, host: "prod-api-01", container: "auth-service", rule: "Health check failing", triggeredAt: "1h 23m ago", status: "firing" as const },
  { id: "a_3", title: "Restart loop: log-shipper", severity: "critical" as const, host: "prod-web-01", container: "log-shipper", rule: "Restarts > 10 in 1h", triggeredAt: "45m ago", status: "firing" as const },
  { id: "a_4", title: "Host offline: dev-sandbox-01", severity: "warning" as const, host: "dev-sandbox-01", container: "—", rule: "Agent offline > 30m", triggeredAt: "3h ago", status: "firing" as const },
  { id: "a_5", title: "Memory usage high on prod-db-01", severity: "warning" as const, host: "prod-db-01", container: "postgres-primary", rule: "Memory > 70%", triggeredAt: "2h ago", status: "acknowledged" as const },
  { id: "a_6", title: "Container exited: notification-svc", severity: "info" as const, host: "prod-api-01", container: "notification-svc", rule: "Container stopped", triggeredAt: "6h ago", status: "resolved" as const },
];

export const incidents = [
  { id: "inc_1", title: "Auth service degradation", severity: "critical" as const, status: "investigating" as const, assignee: "Sarah Chen", startedAt: "1h 23m ago", impactedHosts: 1, impactedContainers: 2, alerts: 2 },
  { id: "inc_2", title: "Log pipeline disruption", severity: "warning" as const, status: "identified" as const, assignee: "Mike Torres", startedAt: "45m ago", impactedHosts: 1, impactedContainers: 1, alerts: 1 },
  { id: "inc_3", title: "API latency spike (resolved)", severity: "warning" as const, status: "resolved" as const, assignee: "Sarah Chen", startedAt: "2d ago", impactedHosts: 2, impactedContainers: 3, alerts: 4 },
];

export const members = [
  { id: "m_1", name: "Sarah Chen", email: "sarah@acmecloud.io", role: "owner" as const, avatar: "SC", lastActive: "Now" },
  { id: "m_2", name: "Mike Torres", email: "mike@acmecloud.io", role: "admin" as const, avatar: "MT", lastActive: "5m ago" },
  { id: "m_3", name: "Priya Sharma", email: "priya@acmecloud.io", role: "developer" as const, avatar: "PS", lastActive: "1h ago" },
  { id: "m_4", name: "James Wilson", email: "james@acmecloud.io", role: "developer" as const, avatar: "JW", lastActive: "3h ago" },
  { id: "m_5", name: "Ana Petrova", email: "ana@acmecloud.io", role: "viewer" as const, avatar: "AP", lastActive: "1d ago" },
];

export const auditLogs = [
  { id: "al_1", action: "alert.created", actor: "Sarah Chen", target: "CPU > 75% rule", timestamp: "10m ago" },
  { id: "al_2", action: "member.invited", actor: "Sarah Chen", target: "alex@contractor.io", timestamp: "2h ago" },
  { id: "al_3", action: "container.restarted", actor: "Mike Torres", target: "auth-service on prod-api-01", timestamp: "3h ago" },
  { id: "al_4", action: "project.created", actor: "Sarah Chen", target: "Dev Sandbox", timestamp: "1d ago" },
  { id: "al_5", action: "api_key.rotated", actor: "Priya Sharma", target: "CI/CD Pipeline Key", timestamp: "2d ago" },
  { id: "al_6", action: "plan.upgraded", actor: "Sarah Chen", target: "Pro → Team", timestamp: "5d ago" },
];

export const activityFeed = [
  { id: "ev_1", type: "alert" as const, message: "High CPU alert triggered on prod-api-01", timestamp: "12m ago" },
  { id: "ev_2", type: "deployment" as const, message: "acme/frontend:v2.14.3 deployed to prod-web-01", timestamp: "45m ago" },
  { id: "ev_3", type: "incident" as const, message: "Incident INC-001 opened: Auth service degradation", timestamp: "1h 23m ago" },
  { id: "ev_4", type: "host" as const, message: "dev-sandbox-01 went offline", timestamp: "3h ago" },
  { id: "ev_5", type: "container" as const, message: "notification-svc exited with code 1", timestamp: "6h ago" },
  { id: "ev_6", type: "deployment" as const, message: "acme/api:v3.8.1 deployed to prod-api-01", timestamp: "7h ago" },
  { id: "ev_7", type: "member" as const, message: "Alex Kim invited to Acme Cloud", timestamp: "2d ago" },
];

export const metricsTimeSeries = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  cpu: Math.round(25 + Math.random() * 40 + (i > 8 && i < 18 ? 15 : 0)),
  memory: Math.round(50 + Math.random() * 25 + (i > 10 && i < 20 ? 10 : 0)),
  network: Math.round(100 + Math.random() * 300 + (i > 9 && i < 17 ? 200 : 0)),
  disk: Math.round(35 + i * 0.3 + Math.random() * 5),
}));

export const logEntries = [
  { id: "l_1", timestamp: "2024-01-15T14:32:01Z", severity: "error" as const, host: "prod-api-01", container: "auth-service", message: "Connection refused to upstream service at 10.0.4.10:5432 — retrying in 5s" },
  { id: "l_2", timestamp: "2024-01-15T14:31:58Z", severity: "warn" as const, host: "prod-api-01", container: "api-gateway", message: "Request queue depth exceeded threshold: 250 pending requests" },
  { id: "l_3", timestamp: "2024-01-15T14:31:55Z", severity: "info" as const, host: "prod-web-01", container: "nginx-proxy", message: "Upstream health check passed for app-frontend:3000" },
  { id: "l_4", timestamp: "2024-01-15T14:31:52Z", severity: "error" as const, host: "prod-web-01", container: "log-shipper", message: "Failed to flush buffer: connection reset by peer" },
  { id: "l_5", timestamp: "2024-01-15T14:31:50Z", severity: "info" as const, host: "prod-worker-01", container: "worker-queue", message: "Processed 1,247 jobs in last 60s — queue depth: 34" },
  { id: "l_6", timestamp: "2024-01-15T14:31:48Z", severity: "debug" as const, host: "prod-db-01", container: "postgres-primary", message: "Checkpoint complete: wrote 2847 buffers (17.4%)" },
  { id: "l_7", timestamp: "2024-01-15T14:31:45Z", severity: "warn" as const, host: "prod-api-01", container: "auth-service", message: "JWT validation latency increased to 340ms (threshold: 200ms)" },
  { id: "l_8", timestamp: "2024-01-15T14:31:42Z", severity: "info" as const, host: "staging-web-01", container: "staging-app", message: "Server started on port 3000 — ready in 1.2s" },
];

export const alertRules = [
  { id: "ar_1", name: "Container Down", type: "container_exit" as const, condition: "Container exits unexpectedly", targets: "All production containers", channels: ["Slack", "Email"], enabled: true },
  { id: "ar_2", name: "High CPU Usage", type: "cpu_threshold" as const, condition: "CPU > 75% for 5 minutes", targets: "All hosts", channels: ["Slack"], enabled: true },
  { id: "ar_3", name: "High Memory Usage", type: "memory_threshold" as const, condition: "Memory > 80% for 10 minutes", targets: "All hosts", channels: ["Slack", "Email"], enabled: true },
  { id: "ar_4", name: "Restart Loop Detection", type: "restart_loop" as const, condition: "Restarts > 5 in 30 minutes", targets: "All containers", channels: ["Slack", "PagerDuty"], enabled: true },
  { id: "ar_5", name: "Host Offline", type: "host_offline" as const, condition: "Agent offline > 5 minutes", targets: "All hosts", channels: ["Slack", "Email", "PagerDuty"], enabled: true },
  { id: "ar_6", name: "Disk Usage Warning", type: "disk_threshold" as const, condition: "Disk > 85%", targets: "All hosts", channels: ["Email"], enabled: false },
  { id: "ar_7", name: "Unhealthy Container", type: "healthcheck_fail" as const, condition: "Health check failing for 3 minutes", targets: "Containers with health checks", channels: ["Slack"], enabled: true },
];

export const plans = [
  { id: "free", name: "Free", price: 0, hosts: 2, users: 1, retention: "24h", alertChannels: 1, support: "Community", features: ["2 hosts", "1 user", "24h data retention", "Basic alerts", "Community support"] },
  { id: "pro", name: "Pro", price: 29, hosts: 10, users: 5, retention: "7d", alertChannels: 3, support: "Email", features: ["10 hosts", "5 users", "7-day retention", "Advanced alerts", "Email support", "API access"] },
  { id: "team", name: "Team", price: 79, hosts: 50, users: 25, retention: "30d", alertChannels: 10, support: "Priority", features: ["50 hosts", "25 users", "30-day retention", "Custom dashboards", "Priority support", "SSO", "Audit logs"] },
  { id: "enterprise", name: "Enterprise", price: -1, hosts: -1, users: -1, retention: "Custom", alertChannels: -1, support: "Dedicated", features: ["Unlimited hosts", "Unlimited users", "Custom retention", "Dedicated support", "SLA", "On-premise option", "Custom integrations"] },
];

export const invoices = [
  { id: "inv_1", date: "Jan 1, 2024", amount: "$79.00", status: "paid" as const, plan: "Team" },
  { id: "inv_2", date: "Dec 1, 2023", amount: "$79.00", status: "paid" as const, plan: "Team" },
  { id: "inv_3", date: "Nov 1, 2023", amount: "$29.00", status: "paid" as const, plan: "Pro" },
  { id: "inv_4", date: "Oct 1, 2023", amount: "$29.00", status: "paid" as const, plan: "Pro" },
];

export const apiKeys = [
  { id: "ak_1", name: "CI/CD Pipeline", prefix: "dk_live_a8f2...3b1c", created: "Dec 15, 2023", lastUsed: "2m ago", scopes: ["read", "write"] },
  { id: "ak_2", name: "Monitoring Integration", prefix: "dk_live_c4d1...9e7f", created: "Nov 20, 2023", lastUsed: "1h ago", scopes: ["read"] },
  { id: "ak_3", name: "Staging Deploy Bot", prefix: "dk_test_b7e3...2a4d", created: "Jan 5, 2024", lastUsed: "3d ago", scopes: ["read", "write", "admin"] },
];

export const deployments = [
  { id: "d_1", image: "acme/frontend:v2.14.3", host: "prod-web-01", status: "success" as const, deployedBy: "Sarah Chen", deployedAt: "45m ago", duration: "32s" },
  { id: "d_2", image: "acme/api:v3.8.1", host: "prod-api-01", status: "success" as const, deployedBy: "CI/CD Pipeline", deployedAt: "7h ago", duration: "1m 12s" },
  { id: "d_3", image: "acme/frontend:v2.15.0-rc1", host: "staging-web-01", status: "success" as const, deployedBy: "Priya Sharma", deployedAt: "2d ago", duration: "28s" },
  { id: "d_4", image: "acme/worker:v2.3.0", host: "prod-worker-01", status: "success" as const, deployedBy: "CI/CD Pipeline", deployedAt: "3d ago", duration: "45s" },
  { id: "d_5", image: "acme/auth:v1.12.0", host: "prod-api-01", status: "failed" as const, deployedBy: "Mike Torres", deployedAt: "4d ago", duration: "2m 3s" },
];

export const notifications = [
  { id: "n_1", title: "Critical: auth-service unhealthy", message: "Health check failing on prod-api-01", time: "1h ago", read: false },
  { id: "n_2", title: "Restart loop detected", message: "log-shipper on prod-web-01 has restarted 15 times", time: "45m ago", read: false },
  { id: "n_3", title: "Host offline", message: "dev-sandbox-01 has been offline for 3 hours", time: "3h ago", read: true },
  { id: "n_4", title: "Deploy successful", message: "acme/frontend:v2.14.3 deployed to production", time: "45m ago", read: true },
];
