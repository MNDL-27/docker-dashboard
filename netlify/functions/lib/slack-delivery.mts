import crypto from 'crypto';

import { decryptSecret, encryptSecret } from './crypto.mjs';
import { sql } from './db.mjs';
import type { AppAuthContext } from './auth.mjs';

type SlackDeliveryEventType = 'alert.opened' | 'alert.acknowledged' | 'alert.resolved' | 'alert.test';

interface SlackDestinationRow {
  id: string;
  organization_id: string;
  name: string;
  webhook_url: string;
  webhook_url_preview: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SlackAttemptRow {
  id: string;
  organization_id: string;
  slack_destination_id: string;
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

function normalizeDestination(row: SlackDestinationRow & {
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
    webhook_url_preview: row.webhook_url_preview,
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

function maskSlackWebhookUrl(webhookUrl: string) {
  try {
    const url = new URL(webhookUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const tail = parts.slice(-2).join('/');
    return `${url.origin}/.../${tail}`;
  } catch {
    return `${webhookUrl.slice(0, 18)}...`;
  }
}

function emojiForSeverity(severity: string) {
  if (severity === 'critical') return ':rotating_light:';
  if (severity === 'error') return ':x:';
  if (severity === 'warning') return ':warning:';
  return ':information_source:';
}

function emojiForStatus(status: string) {
  if (status === 'resolved') return ':white_check_mark:';
  if (status === 'acknowledged') return ':eyes:';
  return ':bell:';
}

function capText(value: string | null | undefined, max = 280) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
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

function buildAppUrl(path: string) {
  const base = (process.env.APP_URL || 'https://app.dockerdash.app').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildSlackPayload(alert: AlertPayloadSource, eventType: SlackDeliveryEventType) {
  const href = buildAppUrl(mapAlertHref(alert));
  const statusLine = `${emojiForSeverity(alert.severity)} ${emojiForStatus(alert.status)} *${alert.title}*`;
  const sourceLabel = `${alert.source_type}:${alert.source_ref}`;
  return {
    text: `${alert.title} (${alert.severity}/${alert.status})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusLine}\n${alert.message}`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `*Event* ${eventType}` },
          { type: 'mrkdwn', text: `*Source* ${sourceLabel}` },
          { type: 'mrkdwn', text: `*Organization* ${alert.organization_id}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open in Docker Dashboard' },
            url: href,
          },
        ],
      },
    ],
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
    INSERT INTO alert_slack_delivery_attempts (
      organization_id, slack_destination_id, alert_event_id, delivery_kind,
      event_type, succeeded, http_status, error_summary, response_excerpt
    )
    VALUES (
      ${params.organizationId}, ${params.destinationId}, ${params.alertEventId ?? null}, ${params.deliveryKind},
      ${params.eventType}, ${params.succeeded}, ${params.httpStatus ?? null}, ${params.errorSummary ?? null}, ${params.responseExcerpt ?? null}
    )
    RETURNING *
  `;

  return attempt as SlackAttemptRow;
}

async function dispatchSlackWebhook(
  destination: SlackDestinationRow,
  webhookUrl: string,
  payload: Record<string, unknown>,
  eventType: SlackDeliveryEventType,
  deliveryKind: 'alert' | 'test',
  alertEventId?: string | null,
) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DockerDash-Slack/1.0',
      },
      body: JSON.stringify(payload),
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
      errorSummary: response.ok ? null : capText(response.statusText || 'Slack responded with non-2xx status'),
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
      errorSummary: capText(error instanceof Error ? error.message : 'Slack request failed'),
    });
  }
}

async function getDestinationForOrg(auth: AppAuthContext, destinationId: string) {
  const rows = await sql`
    SELECT *
    FROM slack_destinations
    WHERE id = ${destinationId} AND organization_id = ${auth.orgId}
    LIMIT 1
  `;
  return (rows[0] as SlackDestinationRow | undefined) ?? null;
}

export async function listSlackDestinations(auth: AppAuthContext) {
  const rows = await sql`
    SELECT
      d.*,
      a.id AS latest_attempt_id,
      a.organization_id AS latest_attempt_org_id,
      a.slack_destination_id AS latest_attempt_destination_id,
      a.alert_event_id AS latest_attempt_alert_event_id,
      a.delivery_kind AS latest_attempt_delivery_kind,
      a.event_type AS latest_attempt_event_type,
      a.succeeded AS latest_attempt_succeeded,
      a.http_status AS latest_attempt_http_status,
      a.error_summary AS latest_attempt_error_summary,
      a.response_excerpt AS latest_attempt_response_excerpt,
      a.attempted_at AS latest_attempt_attempted_at,
      a.created_at AS latest_attempt_created_at
    FROM slack_destinations d
    LEFT JOIN LATERAL (
      SELECT *
      FROM alert_slack_delivery_attempts
      WHERE slack_destination_id = d.id
      ORDER BY attempted_at DESC
      LIMIT 1
    ) a ON true
    WHERE d.organization_id = ${auth.orgId}
    ORDER BY d.created_at DESC
  `;

  return rows.map((row) => normalizeDestination(row as any));
}

export async function createSlackDestination(
  auth: AppAuthContext,
  values: { name: string; webhook_url: string; enabled?: boolean },
) {
  const destinationId = crypto.randomUUID();
  const encryptedWebhookUrl = encryptSecret(values.webhook_url, destinationId, 'webhook_url');
  const [row] = await sql`
    INSERT INTO slack_destinations (
      id, organization_id, name, webhook_url, webhook_url_preview, enabled, created_by
    )
    VALUES (
      ${destinationId}, ${auth.orgId}, ${values.name}, ${encryptedWebhookUrl}, ${maskSlackWebhookUrl(values.webhook_url)}, ${values.enabled ?? true}, ${auth.userId}
    )
    RETURNING *
  `;

  return normalizeDestination(row as any);
}

export async function updateSlackDestination(
  auth: AppAuthContext,
  values: { id: string; name?: string; webhook_url?: string; enabled?: boolean },
) {
  const existing = await getDestinationForOrg(auth, values.id);
  if (!existing) throw new Error('Slack destination not found');

  const nextWebhookUrl = values.webhook_url ? encryptSecret(values.webhook_url, existing.id, 'webhook_url') : existing.webhook_url;
  const nextPreview = values.webhook_url ? maskSlackWebhookUrl(values.webhook_url) : existing.webhook_url_preview;

  const [row] = await sql`
    UPDATE slack_destinations
    SET
      name = ${values.name ?? existing.name},
      webhook_url = ${nextWebhookUrl},
      webhook_url_preview = ${nextPreview},
      enabled = ${Object.prototype.hasOwnProperty.call(values, 'enabled') ? values.enabled : existing.enabled}
    WHERE id = ${values.id} AND organization_id = ${auth.orgId}
    RETURNING *
  `;

  return normalizeDestination(row as any);
}

export async function sendSlackDestinationTest(auth: AppAuthContext, destinationId: string) {
  const destination = await getDestinationForOrg(auth, destinationId);
  if (!destination) throw new Error('Slack destination not found');
  const webhookUrl = decryptSecret(destination.webhook_url, destination.id, 'webhook_url');
  if (!webhookUrl) throw new Error('Slack webhook URL unavailable');

  const payload = {
    text: 'Docker Dashboard Slack test',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':satellite: *Docker Dashboard Slack test*\nYour Slack destination is ready to receive alert notifications.',
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `*Organization* ${auth.orgId}` },
          { type: 'mrkdwn', text: `*Destination* ${destination.name}` },
        ],
      },
    ],
  };

  return dispatchSlackWebhook(destination, webhookUrl, payload, 'alert.test', 'test', null);
}

export async function deliverSlackAlerts(auth: AppAuthContext, alert: AlertPayloadSource, eventType: SlackDeliveryEventType) {
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

  if (!channels.includes('slack')) return [];

  const destinationRows = (await sql`
    SELECT *
    FROM slack_destinations
    WHERE organization_id = ${auth.orgId} AND enabled = true
    ORDER BY created_at DESC
  `) as SlackDestinationRow[];

  if (destinationRows.length === 0) return [];

  const payload = buildSlackPayload(alert, eventType);
  return Promise.all(
    destinationRows.map(async (destination) => {
      const webhookUrl = decryptSecret(destination.webhook_url, destination.id, 'webhook_url');
      if (!webhookUrl) {
        return recordAttempt({
          organizationId: destination.organization_id,
          destinationId: destination.id,
          alertEventId: alert.id,
          deliveryKind: 'alert',
          eventType,
          succeeded: false,
          errorSummary: 'Slack webhook URL unavailable',
        });
      }
      return dispatchSlackWebhook(destination, webhookUrl, payload, eventType, 'alert', alert.id);
    }),
  );
}
