import crypto from 'crypto';

import { sql } from './db.mjs';
import type { AppAuthContext } from './auth.mjs';
import { normalizeAndValidateWebhookUrl } from './host-url.mjs';

type DeliveryEventType = 'alert.opened' | 'alert.acknowledged' | 'alert.resolved' | 'alert.test';

interface WebhookDestinationRow {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  signing_secret: string;
  signing_secret_preview: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DeliveryAttemptRow {
  id: string;
  organization_id: string;
  webhook_destination_id: string;
  alert_event_id: string | null;
  delivery_kind: 'alert' | 'test';
  event_type: string;
  succeeded: boolean;
  http_status: number | null;
  error_summary: string | null;
  response_excerpt: string | null;
  attempted_at: string;
  created_at: string;
}

interface AlertPayloadSource {
  id: string;
  organization_id: string;
  incident_id?: string | null;
  rule_id?: string | null;
  source_type: 'host' | 'container' | 'metric' | 'system';
  source_ref: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  metadata?: Record<string, unknown>;
  first_seen_at?: string;
  last_seen_at?: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
  href?: string;
}

function normalizeDestination(row: WebhookDestinationRow & {
  latest_attempt_id?: string | null;
  latest_attempt_org_id?: string | null;
  latest_attempt_destination_id?: string | null;
  latest_attempt_alert_event_id?: string | null;
  latest_attempt_delivery_kind?: 'alert' | 'test' | null;
  latest_attempt_event_type?: string | null;
  latest_attempt_succeeded?: boolean | null;
  latest_attempt_http_status?: number | null;
  latest_attempt_error_summary?: string | null;
  latest_attempt_response_excerpt?: string | null;
  latest_attempt_attempted_at?: string | null;
  latest_attempt_created_at?: string | null;
}) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    url: row.url,
    signing_secret_preview: row.signing_secret_preview,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    latest_attempt: row.latest_attempt_id ? {
      id: row.latest_attempt_id,
      organization_id: row.latest_attempt_org_id!,
      webhook_destination_id: row.latest_attempt_destination_id!,
      alert_event_id: row.latest_attempt_alert_event_id ?? null,
      delivery_kind: row.latest_attempt_delivery_kind!,
      event_type: row.latest_attempt_event_type!,
      succeeded: !!row.latest_attempt_succeeded,
      http_status: row.latest_attempt_http_status ?? null,
      error_summary: row.latest_attempt_error_summary ?? null,
      response_excerpt: row.latest_attempt_response_excerpt ?? null,
      attempted_at: row.latest_attempt_attempted_at!,
      created_at: row.latest_attempt_created_at!,
    } : null,
  };
}

function buildSecret() {
  const secret = crypto.randomBytes(24).toString('hex');
  return {
    secret,
    preview: `${secret.slice(0, 6)}...${secret.slice(-4)}`,
  };
}

function capText(value: string | null | undefined, max = 280) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function mapAlertHref(alert: AlertPayloadSource) {
  if (alert.href) return alert.href;
  const metadata = alert.metadata ?? {};
  const hostId = typeof metadata.host_id === 'string' ? metadata.host_id : null;
  const containerShortId =
    typeof metadata.container_short_id === 'string'
      ? metadata.container_short_id
      : typeof metadata.container_id === 'string'
        ? metadata.container_id.slice(0, 12)
        : null;
  if ((alert.source_type === 'container' || alert.source_type === 'metric') && containerShortId && hostId) return `/app/containers/${containerShortId}?host=${hostId}`;
  if (hostId) return `/app/hosts/${hostId}`;
  return '/app/alerts';
}

function buildSignedRequestBody(destination: Pick<WebhookDestinationRow, 'signing_secret'>, payload: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', destination.signing_secret).update(`${timestamp}.${body}`).digest('hex');
  return {
    body,
    timestamp,
    signature: `sha256=${signature}`,
  };
}

async function recordAttempt(params: {
  organizationId: string;
  destinationId: string;
  alertEventId?: string | null;
  deliveryKind: 'alert' | 'test';
  eventType: string;
  succeeded: boolean;
  httpStatus?: number | null;
  errorSummary?: string | null;
  responseExcerpt?: string | null;
}) {
  const [attempt] = await sql`
    INSERT INTO alert_delivery_attempts (
      organization_id, webhook_destination_id, alert_event_id, delivery_kind,
      event_type, succeeded, http_status, error_summary, response_excerpt
    )
    VALUES (
      ${params.organizationId}, ${params.destinationId}, ${params.alertEventId ?? null}, ${params.deliveryKind},
      ${params.eventType}, ${params.succeeded}, ${params.httpStatus ?? null}, ${params.errorSummary ?? null}, ${params.responseExcerpt ?? null}
    )
    RETURNING *
  `;

  return attempt as DeliveryAttemptRow;
}

const DISCORD_URL_RE = /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//;

function isDiscordUrl(url: string) {
  return DISCORD_URL_RE.test(url);
}

const SEVERITY_COLORS: Record<string, number> = {
  critical: 0xef4444, // red
  warning:  0xf59e0b, // amber
  info:     0x3b82f6, // blue
  ok:       0x22c55e, // green
};

function buildDiscordBody(payload: Record<string, unknown>, eventType: DeliveryEventType) {
  const alert = (payload.alert ?? payload.sample ?? {}) as Record<string, unknown>;
  const severity = String(alert.severity ?? 'info').toLowerCase();
  const status   = String(alert.status ?? eventType);
  const title    = String(alert.title ?? 'Docker Dashboard Alert');
  const message  = String(alert.message ?? '');
  const href     = typeof alert.href === 'string' ? alert.href : null;

  const color = SEVERITY_COLORS[severity] ?? 0x6366f1; // indigo fallback

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: 'Event',    value: `\`${eventType}\``, inline: true },
    { name: 'Severity', value: severity,           inline: true },
    { name: 'Status',   value: status,             inline: true },
  ];

  if (alert.source_type)  fields.push({ name: 'Source', value: String(alert.source_type), inline: true });
  if (alert.source_ref)   fields.push({ name: 'Ref',    value: `\`${String(alert.source_ref)}\``, inline: true });

  const embed: Record<string, unknown> = {
    title,
    description: message || undefined,
    color,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'Docker Dashboard' },
  };

  if (href) {
    const base = process.env.URL || 'https://app.dockerdash.app';
    embed.url = href.startsWith('http') ? href : `${base}${href}`;
  }

  return JSON.stringify({ embeds: [embed] });
}

async function dispatchWebhook(
  destination: WebhookDestinationRow,
  payload: Record<string, unknown>,
  eventType: DeliveryEventType,
  deliveryKind: 'alert' | 'test',
  alertEventId?: string | null,
) {
  const discord = isDiscordUrl(destination.url);

  // Build request body — Discord gets embeds, everything else gets signed payload
  let body: string;
  let headers: Record<string, string>;

  if (discord) {
    body = buildDiscordBody(payload, eventType);
    headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'DockerDash-Webhooks/1.0',
    };
  } else {
    const signed = buildSignedRequestBody(destination, payload);
    body = signed.body;
    headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'DockerDash-Webhooks/1.0',
      'X-DockerDash-Event': eventType,
      'X-DockerDash-Timestamp': signed.timestamp,
      'X-DockerDash-Signature': signed.signature,
    };
  }

  try {
    const response = await fetch(destination.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(8000),
    });
    const responseText = capText(await response.text());
    return recordAttempt({
      organizationId: destination.organization_id,
      destinationId: destination.id,
      alertEventId,
      deliveryKind,
      eventType,
      succeeded: response.ok,
      httpStatus: response.status,
      errorSummary: response.ok ? null : capText(response.statusText || 'Webhook responded with non-2xx status'),
      responseExcerpt: responseText,
    });
  } catch (error) {
    return recordAttempt({
      organizationId: destination.organization_id,
      destinationId: destination.id,
      alertEventId,
      deliveryKind,
      eventType,
      succeeded: false,
      errorSummary: capText(error instanceof Error ? error.message : 'Webhook request failed'),
    });
  }
}

async function getDestinationForOrg(auth: AppAuthContext, destinationId: string) {
  const rows = await sql`
    SELECT *
    FROM webhook_destinations
    WHERE id = ${destinationId} AND organization_id = ${auth.orgId}
    LIMIT 1
  `;
  return (rows[0] as WebhookDestinationRow | undefined) ?? null;
}

export async function listWebhookDestinations(auth: AppAuthContext) {
  const rows = await sql`
    SELECT
      d.*,
      a.id AS latest_attempt_id,
      a.organization_id AS latest_attempt_org_id,
      a.webhook_destination_id AS latest_attempt_destination_id,
      a.alert_event_id AS latest_attempt_alert_event_id,
      a.delivery_kind AS latest_attempt_delivery_kind,
      a.event_type AS latest_attempt_event_type,
      a.succeeded AS latest_attempt_succeeded,
      a.http_status AS latest_attempt_http_status,
      a.error_summary AS latest_attempt_error_summary,
      a.response_excerpt AS latest_attempt_response_excerpt,
      a.attempted_at AS latest_attempt_attempted_at,
      a.created_at AS latest_attempt_created_at
    FROM webhook_destinations d
    LEFT JOIN LATERAL (
      SELECT *
      FROM alert_delivery_attempts
      WHERE webhook_destination_id = d.id
      ORDER BY attempted_at DESC
      LIMIT 1
    ) a ON true
    WHERE d.organization_id = ${auth.orgId}
    ORDER BY d.created_at DESC
  `;

  return rows.map((row) => normalizeDestination(row as any));
}

export async function createWebhookDestination(
  auth: AppAuthContext,
  values: { name: string; url: string; enabled?: boolean },
) {
  const destinationUrl = normalizeAndValidateWebhookUrl(values.url);
  const { secret, preview } = buildSecret();
  const [row] = await sql`
    INSERT INTO webhook_destinations (
      organization_id, name, url, signing_secret, signing_secret_preview, enabled, created_by
    )
    VALUES (
      ${auth.orgId}, ${values.name}, ${destinationUrl}, ${secret}, ${preview}, ${values.enabled ?? true}, ${auth.userId}
    )
    RETURNING *
  `;

  return {
    destination: normalizeDestination(row as any),
    signing_secret: secret,
  };
}

export async function updateWebhookDestination(
  auth: AppAuthContext,
  values: { id: string; name?: string; url?: string; enabled?: boolean; regenerate_secret?: boolean },
) {
  const existing = await getDestinationForOrg(auth, values.id);
  if (!existing) throw new Error('Webhook destination not found');

  const secretState = values.regenerate_secret ? buildSecret() : {
    secret: existing.signing_secret,
    preview: existing.signing_secret_preview,
  };
  const nextUrl = values.url ? normalizeAndValidateWebhookUrl(values.url) : existing.url;

  const [row] = await sql`
    UPDATE webhook_destinations
    SET
      name = ${values.name ?? existing.name},
      url = ${nextUrl},
      enabled = ${Object.prototype.hasOwnProperty.call(values, 'enabled') ? values.enabled : existing.enabled},
      signing_secret = ${secretState.secret},
      signing_secret_preview = ${secretState.preview}
    WHERE id = ${values.id} AND organization_id = ${auth.orgId}
    RETURNING *
  `;

  return {
    destination: normalizeDestination(row as any),
    signing_secret: values.regenerate_secret ? secretState.secret : undefined,
  };
}

export async function sendWebhookDestinationTest(auth: AppAuthContext, destinationId: string) {
  const destination = await getDestinationForOrg(auth, destinationId);
  if (!destination) throw new Error('Webhook destination not found');

  const payload = {
    event_type: 'alert.test',
    sent_at: new Date().toISOString(),
    organization_id: auth.orgId,
    destination_id: destination.id,
    sample: {
      severity: 'warning',
      status: 'open',
      title: 'Webhook test from Docker Dashboard',
      message: 'This is a signed test delivery from your alert webhook configuration.',
      href: '/app/settings?tab=Webhooks',
    },
  };

  return dispatchWebhook(destination, payload, 'alert.test', 'test', null);
}

export async function deliverAlertWebhooks(auth: AppAuthContext, alert: AlertPayloadSource, eventType: DeliveryEventType) {
  if (!alert.rule_id) return [];

  const ruleRows = await sql`
    SELECT notification_channels
    FROM alert_rules
    WHERE id = ${alert.rule_id} AND organization_id = ${auth.orgId}
    LIMIT 1
  `;

  const channels = Array.isArray(ruleRows[0]?.notification_channels)
    ? ruleRows[0].notification_channels.filter((item: unknown): item is string => typeof item === 'string')
    : [];

  if (!channels.includes('webhook')) return [];

  const destinationRows = await sql`
    SELECT *
    FROM webhook_destinations
    WHERE organization_id = ${auth.orgId} AND enabled = true
    ORDER BY created_at DESC
  `;

  if (destinationRows.length === 0) return [];

  const payload = {
    event_type: eventType,
    organization_id: alert.organization_id,
    alert: {
      id: alert.id,
      incident_id: alert.incident_id ?? null,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      message: alert.message,
      source_type: alert.source_type,
      source_ref: alert.source_ref,
      first_seen_at: alert.first_seen_at ?? null,
      last_seen_at: alert.last_seen_at ?? null,
      acknowledged_at: alert.acknowledged_at ?? null,
      resolved_at: alert.resolved_at ?? null,
      created_at: alert.created_at ?? null,
      updated_at: alert.updated_at ?? null,
      href: mapAlertHref(alert),
      metadata: alert.metadata ?? {},
    },
  };

  return Promise.all(
    (destinationRows as WebhookDestinationRow[]).map((destination) =>
      dispatchWebhook(destination, payload, eventType, 'alert', alert.id),
    ),
  );
}
