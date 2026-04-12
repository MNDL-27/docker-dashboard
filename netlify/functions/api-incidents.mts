import type { Config } from '@netlify/functions';
import { requireAuth } from './lib/auth.mjs';
import { sql } from './lib/db.mjs';
import { ensureAlertsSchema } from './lib/ensure-alerts-schema.mjs';
import { listAlertHistory, listIncidents, requireOrganizationAdmin } from './lib/alerts.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    await ensureAlertsSchema();
    const auth = await requireAuth(req);

    if (req.method === 'GET') {
      const [incidents, history] = await Promise.all([listIncidents(auth), listAlertHistory(auth)]);
      return new Response(JSON.stringify({ incidents, history }), { headers });
    }

    if (req.method === 'POST') {
      await requireOrganizationAdmin(auth);
      const body = await req.json();
      if (!body?.source_alert_event_id) {
        return new Response(JSON.stringify({ error: 'source_alert_event_id required' }), { status: 400, headers });
      }

      const [sourceAlert] = await sql`
        SELECT *
        FROM alert_events
        WHERE id = ${body.source_alert_event_id} AND organization_id = ${auth.orgId}
      `;

      if (!sourceAlert) {
        return new Response(JSON.stringify({ error: 'Alert not found' }), { status: 404, headers });
      }

      const existing = await sql`
        SELECT *
        FROM incidents
        WHERE organization_id = ${auth.orgId}
          AND source_alert_event_id = ${body.source_alert_event_id}
          AND resolved_at IS NULL
        LIMIT 1
      `;

      if (existing.length > 0) {
        return new Response(JSON.stringify(existing[0]), { headers });
      }

      const [incident] = await sql`
        INSERT INTO incidents (
          organization_id, source_alert_event_id, title, summary,
          severity, status, metadata, opened_by
        )
        VALUES (
          ${auth.orgId}, ${body.source_alert_event_id},
          ${body.title || sourceAlert.title},
          ${body.summary || sourceAlert.message},
          ${body.severity || sourceAlert.severity},
          'open',
          ${JSON.stringify({ source_type: sourceAlert.source_type, source_ref: sourceAlert.source_ref })},
          ${auth.userId}
        )
        RETURNING *
      `;

      await sql`
        UPDATE alert_events
        SET
          incident_id = ${incident.id},
          status = CASE WHEN status = 'open' THEN 'acknowledged' ELSE status END,
          acknowledged_at = COALESCE(acknowledged_at, now()),
          acknowledged_by = COALESCE(acknowledged_by, ${auth.userId})
        WHERE id = ${body.source_alert_event_id}
      `;

      return new Response(JSON.stringify(incident), { status: 201, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error: any) {
    const status = /Admin access required|Access denied/.test(error?.message || '') ? 403 : 500;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to process incidents' }), { status, headers });
  }
};

export const config: Config = {
  path: '/api/incidents',
};
