import { sql } from './db.mjs';
import { decryptHostSecrets } from './crypto.mjs';
import type { AppAuthContext } from './auth.mjs';
import { deliverSlackAlerts } from './slack-delivery.mjs';
import { deliverAlertWebhooks } from './webhook-destinations.mjs';

type OrgRole = 'owner' | 'admin' | 'member' | 'viewer' | string;
type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
type AlertStatus = 'open' | 'acknowledged' | 'resolved';
type AlertConditionType = 'host_offline' | 'container_exited' | 'container_restart_loop' | 'cpu_usage' | 'memory_usage';

interface AlertRuleRow {
  id: string;
  organization_id: string;
  name: string;
  condition_type: AlertConditionType;
  resource_scope: Record<string, unknown> | null;
  threshold_value: number | string | null;
  threshold_window_minutes: number;
  severity: AlertSeverity;
  notification_channels: string[] | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DockerHostRow {
  id: string;
  organization_id: string;
  name: string;
  host_url: string;
  connection_mode: string;
  docker_socket_path: string | null;
  status: string;
  last_seen_at: string | null;
  last_error: string | null;
}

interface ContainerRow {
  Id: string;
  Names?: string[];
  Image?: string;
  State?: string;
  Status?: string;
  _hostId: string;
  _hostName: string;
}

interface ContainerStatRow {
  containerId: string;
  hostId: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
}

interface DerivedAlertSignal {
  ruleId: string;
  fingerprint: string;
  sourceType: 'host' | 'container' | 'metric';
  sourceRef: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata: Record<string, unknown>;
}

interface AlertEventRow {
  id: string;
  organization_id: string;
  rule_id: string | null;
  incident_id: string | null;
  fingerprint: string;
  source_type: 'host' | 'container' | 'metric' | 'system';
  source_ref: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_RULE_DEFINITIONS: Array<{
  name: string;
  condition_type: AlertConditionType;
  threshold_value: number | null;
  threshold_window_minutes: number;
  severity: AlertSeverity;
  notification_channels: string[];
}> = [
  { name: 'Host offline', condition_type: 'host_offline', threshold_value: null, threshold_window_minutes: 5, severity: 'critical', notification_channels: ['slack'] },
  { name: 'Container exited', condition_type: 'container_exited', threshold_value: null, threshold_window_minutes: 5, severity: 'warning', notification_channels: ['slack'] },
  { name: 'Restart loop detected', condition_type: 'container_restart_loop', threshold_value: 1, threshold_window_minutes: 5, severity: 'error', notification_channels: ['slack', 'email'] },
  { name: 'CPU usage threshold', condition_type: 'cpu_usage', threshold_value: 85, threshold_window_minutes: 5, severity: 'warning', notification_channels: ['email'] },
  { name: 'Memory usage threshold', condition_type: 'memory_usage', threshold_value: 90, threshold_window_minutes: 5, severity: 'warning', notification_channels: ['email'] },
];

function normalizeThresholdValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeAlertRule(row: AlertRuleRow) {
  return {
    ...row,
    threshold_value: normalizeThresholdValue(row.threshold_value),
    notification_channels: normalizeChannels(row.notification_channels),
    resource_scope: row.resource_scope ?? { scope: 'organization' },
  };
}

function trimContainerName(container: Pick<ContainerRow, 'Names' | 'Id'>) {
  return container.Names?.[0]?.replace(/^\//, '') || container.Id.slice(0, 12);
}

function buildDockerRequest(
  host: Pick<DockerHostRow, 'host_url' | 'connection_mode' | 'docker_socket_path'>,
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
  dockerPath: string,
) {
  const base = host.host_url.replace(/\/$/, '');
  const headers: Record<string, string> = {};

  if (secrets?.agent_api_key) headers['X-Agent-Key'] = secrets.agent_api_key;
  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') headers['X-Docker-Socket'] = host.docker_socket_path;
  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) headers['CF-Access-Client-Id'] = secrets.cf_service_token_id;
    if (secrets?.cf_service_token_secret) headers['CF-Access-Client-Secret'] = secrets.cf_service_token_secret;
  }

  return { url: `${base}/docker${dockerPath}`, headers };
}

async function dockerFetchJson<T>(
  host: Pick<DockerHostRow, 'host_url' | 'connection_mode' | 'docker_socket_path'>,
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
  dockerPath: string,
  timeoutMs = 5000,
): Promise<T | null> {
  try {
    const request = buildDockerRequest(host, secrets, dockerPath);
    const response = await fetch(request.url, { method: 'GET', headers: request.headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function getOrganizationRole(auth: AppAuthContext): Promise<OrgRole> {
  const memberships = await sql`
    SELECT role
    FROM organization_members
    WHERE organization_id = ${auth.orgId} AND user_id = ${auth.userId}
    LIMIT 1
  `;
  if (memberships.length === 0) throw new Error('Access denied');
  return memberships[0].role;
}

export async function requireOrganizationAdmin(auth: AppAuthContext) {
  const role = await getOrganizationRole(auth);
  if (!['owner', 'admin'].includes(role)) throw new Error('Admin access required for active organization');
  return role;
}

export async function ensureDefaultAlertRules(auth: AppAuthContext) {
  const existing = await sql`
    SELECT COUNT(*)::int AS count
    FROM alert_rules
    WHERE organization_id = ${auth.orgId}
  `;
  if (existing[0]?.count > 0) return;

  for (const rule of DEFAULT_RULE_DEFINITIONS) {
    await sql`
      INSERT INTO alert_rules (
        organization_id, name, condition_type, resource_scope, threshold_value,
        threshold_window_minutes, severity, notification_channels, enabled, created_by
      )
      VALUES (
        ${auth.orgId}, ${rule.name}, ${rule.condition_type}, ${{ scope: 'organization' }},
        ${rule.threshold_value}, ${rule.threshold_window_minutes}, ${rule.severity},
        ${JSON.stringify(rule.notification_channels)}, true, ${auth.userId}
      )
    `;
  }
}

export async function listAlertRules(auth: AppAuthContext) {
  await ensureDefaultAlertRules(auth);
  const rows = await sql`
    SELECT *
    FROM alert_rules
    WHERE organization_id = ${auth.orgId}
    ORDER BY created_at ASC
  `;
  return (rows as AlertRuleRow[]).map(normalizeAlertRule);
}

async function listAccessibleHosts(auth: AppAuthContext): Promise<DockerHostRow[]> {
  const rows = await sql`
    SELECT h.*
    FROM docker_hosts h
    JOIN organization_members om ON h.organization_id = om.organization_id
    WHERE h.organization_id = ${auth.orgId} AND om.user_id = ${auth.userId}
    ORDER BY h.created_at DESC
  `;
  return rows as DockerHostRow[];
}

async function loadHostSecrets(hostId: string) {
  const rows = await sql`
    SELECT agent_api_key, cf_service_token_id, cf_service_token_secret
    FROM docker_host_secrets
    WHERE host_id = ${hostId}
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0] : null;
}

async function fetchContainersForHosts(hosts: DockerHostRow[]): Promise<ContainerRow[]> {
  const collected: ContainerRow[] = [];
  await mapConcurrent(hosts, 4, async (host) => {
    const encryptedSecrets = await loadHostSecrets(host.id);
    const secrets = decryptHostSecrets(encryptedSecrets, host.id);
    const containers = await dockerFetchJson<any[]>(host, secrets, '/containers/json?all=true', 6000);
    if (!Array.isArray(containers)) return null;
    collected.push(...containers.map((container) => ({ ...container, _hostId: host.id, _hostName: host.name })));
    return null;
  });
  return collected;
}

async function fetchContainerStatsForHosts(hosts: DockerHostRow[]): Promise<ContainerStatRow[]> {
  const allStats: ContainerStatRow[] = [];
  await mapConcurrent(hosts.filter((host) => host.status === 'connected'), 3, async (host) => {
    const encryptedSecrets = await loadHostSecrets(host.id);
    const secrets = decryptHostSecrets(encryptedSecrets, host.id);
    const containers = await dockerFetchJson<any[]>(host, secrets, '/containers/json', 4000);
    if (!Array.isArray(containers)) return null;
    await mapConcurrent(containers.slice(0, 20), 4, async (container) => {
      const stats = await dockerFetchJson<any>(host, secrets, `/containers/${container.Id}/stats?stream=false`, 4000);
      if (!stats) return null;
      const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
      const systemDelta = (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
      const onlineCpus = stats.cpu_stats?.online_cpus || 1;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;
      allStats.push({
        containerId: container.Id,
        hostId: host.id,
        cpu_percent: Math.round(cpuPercent * 100) / 100,
        memory_usage: stats.memory_stats?.usage ?? 0,
        memory_limit: stats.memory_stats?.limit ?? 0,
      });
      return null;
    });
    return null;
  });
  return allStats;
}

function deriveAlertSignals(
  rules: ReturnType<typeof normalizeAlertRule>[],
  hosts: DockerHostRow[],
  containers: ContainerRow[],
  stats: ContainerStatRow[],
): DerivedAlertSignal[] {
  const signals: DerivedAlertSignal[] = [];
  const containersById = new Map(containers.map((container) => [container.Id, container]));

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.condition_type === 'host_offline') {
      for (const host of hosts.filter((item) => ['stale', 'error', 'disconnected', 'unhealthy'].includes(item.status))) {
        signals.push({
          ruleId: rule.id,
          fingerprint: `${rule.id}:${host.id}:${host.status}`,
          sourceType: 'host',
          sourceRef: host.id,
          title: host.status === 'stale' ? 'Host connection stale' : 'Host offline',
          message: host.last_error ? `${host.name} is ${host.status}. ${host.last_error}` : `${host.name} is ${host.status}. Check agent connectivity.`,
          severity: rule.severity,
          metadata: { host_id: host.id, host_name: host.name, host_status: host.status },
        });
      }
    }

    if (rule.condition_type === 'container_exited') {
      for (const container of containers.filter((item) => item.State === 'exited')) {
        signals.push({
          ruleId: rule.id,
          fingerprint: `${rule.id}:${container._hostId}:${container.Id}:exited`,
          sourceType: 'container',
          sourceRef: container.Id,
          title: 'Container exited',
          message: `${trimContainerName(container)} on ${container._hostName} is stopped and needs review.`,
          severity: rule.severity,
          metadata: { host_id: container._hostId, host_name: container._hostName, container_id: container.Id, container_short_id: container.Id.slice(0, 12), container_name: trimContainerName(container), image: container.Image ?? null },
        });
      }
    }

    if (rule.condition_type === 'container_restart_loop') {
      for (const container of containers.filter((item) => item.State === 'restarting')) {
        signals.push({
          ruleId: rule.id,
          fingerprint: `${rule.id}:${container._hostId}:${container.Id}:restarting`,
          sourceType: 'container',
          sourceRef: container.Id,
          title: 'Restart loop detected',
          message: `${trimContainerName(container)} on ${container._hostName} is restarting repeatedly.`,
          severity: rule.severity,
          metadata: { host_id: container._hostId, host_name: container._hostName, container_id: container.Id, container_short_id: container.Id.slice(0, 12), container_name: trimContainerName(container), image: container.Image ?? null },
        });
      }
    }

    if (rule.condition_type === 'cpu_usage') {
      const threshold = normalizeThresholdValue(rule.threshold_value) ?? 85;
      for (const stat of stats.filter((item) => item.cpu_percent >= threshold)) {
        const container = containersById.get(stat.containerId);
        if (!container) continue;
        signals.push({
          ruleId: rule.id,
          fingerprint: `${rule.id}:${stat.hostId}:${stat.containerId}:cpu`,
          sourceType: 'metric',
          sourceRef: stat.containerId,
          title: 'High CPU usage',
          message: `${trimContainerName(container)} on ${container._hostName} is at ${stat.cpu_percent.toFixed(1)}% CPU.`,
          severity: rule.severity,
          metadata: { host_id: container._hostId, host_name: container._hostName, container_id: container.Id, container_short_id: container.Id.slice(0, 12), container_name: trimContainerName(container), metric: 'cpu_percent', metric_value: stat.cpu_percent, threshold },
        });
      }
    }

    if (rule.condition_type === 'memory_usage') {
      const threshold = normalizeThresholdValue(rule.threshold_value) ?? 90;
      for (const stat of stats) {
        const memoryPercent = stat.memory_limit > 0 ? (stat.memory_usage / stat.memory_limit) * 100 : 0;
        if (memoryPercent < threshold) continue;
        const container = containersById.get(stat.containerId);
        if (!container) continue;
        signals.push({
          ruleId: rule.id,
          fingerprint: `${rule.id}:${stat.hostId}:${stat.containerId}:memory`,
          sourceType: 'metric',
          sourceRef: stat.containerId,
          title: 'High memory usage',
          message: `${trimContainerName(container)} on ${container._hostName} is at ${memoryPercent.toFixed(1)}% memory.`,
          severity: rule.severity,
          metadata: { host_id: container._hostId, host_name: container._hostName, container_id: container.Id, container_short_id: container.Id.slice(0, 12), container_name: trimContainerName(container), metric: 'memory_percent', metric_value: Number(memoryPercent.toFixed(2)), threshold },
        });
      }
    }
  }

  return signals;
}

function mapAlertHref(event: AlertEventRow) {
  const metadata = event.metadata ?? {};
  const hostId = typeof metadata.host_id === 'string' ? metadata.host_id : null;
  const containerShortId = typeof metadata.container_short_id === 'string' ? metadata.container_short_id : typeof metadata.container_id === 'string' ? metadata.container_id.slice(0, 12) : null;
  if ((event.source_type === 'container' || event.source_type === 'metric') && containerShortId && hostId) return `/app/containers/${containerShortId}?host=${hostId}`;
  if (hostId) return `/app/hosts/${hostId}`;
  return '/app/alerts';
}

export async function syncAlertEvents(auth: AppAuthContext) {
  const rules = await listAlertRules(auth);
  const hosts = await listAccessibleHosts(auth);
  const needsStats = rules.some((rule) => rule.enabled && ['cpu_usage', 'memory_usage'].includes(rule.condition_type));
  const containers = hosts.length > 0 ? await fetchContainersForHosts(hosts) : [];
  const stats = needsStats && hosts.length > 0 ? await fetchContainerStatsForHosts(hosts) : [];
  const derivedSignals = deriveAlertSignals(rules, hosts, containers, stats);

  const activeEvents = (await sql`
    SELECT id, fingerprint
    FROM alert_events
    WHERE organization_id = ${auth.orgId} AND resolved_at IS NULL
  `) as Array<{ id: string; fingerprint: string }>;

  const activeByFingerprint = new Map(activeEvents.map((event) => [event.fingerprint, event]));

  for (const signal of derivedSignals) {
    const existing = activeByFingerprint.get(signal.fingerprint);

    if (existing) {
      await sql`
        UPDATE alert_events
        SET
          rule_id = ${signal.ruleId},
          title = ${signal.title},
          message = ${signal.message},
          severity = ${signal.severity},
          metadata = ${JSON.stringify(signal.metadata)},
          last_seen_at = now(),
          updated_at = now()
        WHERE id = ${existing.id}
      `;
      continue;
    }

    const insertedRows = await sql`
      INSERT INTO alert_events (
        organization_id, rule_id, fingerprint, source_type, source_ref,
        title, message, severity, status, metadata, first_seen_at, last_seen_at
      )
      VALUES (
        ${auth.orgId}, ${signal.ruleId}, ${signal.fingerprint}, ${signal.sourceType}, ${signal.sourceRef},
        ${signal.title}, ${signal.message}, ${signal.severity}, 'open', ${JSON.stringify(signal.metadata)}, now(), now()
      )
      RETURNING *
    `;
    await deliverSlackAlerts(auth, insertedRows[0] as AlertEventRow, 'alert.opened');
    await deliverAlertWebhooks(auth, insertedRows[0] as AlertEventRow, 'alert.opened');
  }

  const activeFingerprints = new Set(derivedSignals.map((signal) => signal.fingerprint));
  const staleEvents = activeEvents.filter((event) => !activeFingerprints.has(event.fingerprint));

  for (const event of staleEvents) {
    const resolvedRows = await sql`
      UPDATE alert_events
      SET status = 'resolved', resolved_at = COALESCE(resolved_at, now()), updated_at = now()
      WHERE id = ${event.id}
      RETURNING *
    `;
    if (resolvedRows[0]) {
      await deliverSlackAlerts(auth, resolvedRows[0] as AlertEventRow, 'alert.resolved');
      await deliverAlertWebhooks(auth, resolvedRows[0] as AlertEventRow, 'alert.resolved');
    }
  }
}

export async function listAlertEvents(
  auth: AppAuthContext,
  filters: { severity?: string | null; status?: string | null } = {},
) {
  await syncAlertEvents(auth);

  const rows = (await sql`
    SELECT *
    FROM alert_events
    WHERE organization_id = ${auth.orgId}
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 0
        WHEN 'error' THEN 1
        WHEN 'warning' THEN 2
        ELSE 3
      END,
      last_seen_at DESC
  `) as AlertEventRow[];

  return rows
    .filter((row) => (filters.severity ? row.severity === filters.severity : true))
    .filter((row) => (filters.status ? row.status === filters.status : row.resolved_at === null))
    .map((row) => ({
      ...row,
      href: mapAlertHref(row),
    }));
}

export async function listIncidents(auth: AppAuthContext) {
  return sql`
    SELECT i.*, e.title AS source_alert_title
    FROM incidents i
    LEFT JOIN alert_events e ON e.id = i.source_alert_event_id
    WHERE i.organization_id = ${auth.orgId}
    ORDER BY i.opened_at DESC
    LIMIT 12
  `;
}

export async function listAlertHistory(auth: AppAuthContext) {
  const rows = (await sql`
    SELECT *
    FROM alert_events
    WHERE organization_id = ${auth.orgId}
    ORDER BY updated_at DESC
    LIMIT 12
  `) as AlertEventRow[];

  return rows.map((row) => ({
    ...row,
    href: mapAlertHref(row),
  }));
}

export async function buildAlertsWorkspaceSummary(auth: AppAuthContext) {
  const [rules, activeAlerts, incidents] = await Promise.all([
    listAlertRules(auth),
    listAlertEvents(auth),
    listIncidents(auth),
  ]);

  const activeOnly = activeAlerts.filter((alert) => alert.resolved_at === null);

  return {
    total_alerts: activeOnly.length,
    critical_alerts: activeOnly.filter((alert) => alert.severity === 'critical').length,
    enabled_rules: rules.filter((rule) => rule.enabled).length,
    open_incidents: incidents.filter((incident: any) => incident.status !== 'resolved').length,
  };
}
