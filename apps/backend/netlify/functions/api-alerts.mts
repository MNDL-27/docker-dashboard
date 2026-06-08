import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import { requireAuth } from './lib/auth.mjs';
import { sql } from './lib/db.mjs';
import { ensureAlertsSchema } from './lib/ensure-alerts-schema.mjs';
import { getOrganizationRole, listAlertEvents, listAlertRules, listIncidents, requireOrganizationAdmin } from './lib/alerts.mjs';
import { deliverSlackAlerts } from './lib/slack-delivery.mjs';
import { deliverAlertWebhooks } from './lib/webhook-destinations.mjs';


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    await ensureAlertsSchema();
    const auth = await requireAuth(req);
    const role = await getOrganizationRole(auth);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const severity = url.searchParams.get('severity');
      const status = url.searchParams.get('status');
      const [alerts, rules, incidents] = await Promise.all([
        listAlertEvents(auth, { severity, status }),
        listAlertRules(auth),
        listIncidents(auth),
      ]);

      const activeAlerts = alerts.filter((alert) => alert.resolved_at === null);
      const summary = {
        total_alerts: activeAlerts.length,
        critical_alerts: activeAlerts.filter((alert) => alert.severity === 'critical').length,
        enabled_rules: rules.filter((rule) => rule.enabled).length,
        open_incidents: incidents.filter((incident: any) => incident.status !== 'resolved').length,
      };

      return new Response(JSON.stringify({ alerts, summary, role, can_manage: ['owner', 'admin'].includes(role) }), { headers: buildHeaders(req) });
    }

    if (req.method === 'POST') {
      await requireOrganizationAdmin(auth);
      const body = await req.json();
      if (!body?.id || !body?.action) {
        return new Response(JSON.stringify({ error: 'Alert id and action required' }), { status: 400, headers: buildHeaders(req) });
      }

      if (body.action === 'acknowledge') {
        const [alert] = await sql`
          UPDATE alert_events
          SET status = 'acknowledged', acknowledged_at = COALESCE(acknowledged_at, now()), acknowledged_by = ${auth.userId}
          WHERE id = ${body.id} AND organization_id = ${auth.orgId}
          RETURNING *
        `;
        if (alert) {
          await deliverSlackAlerts(auth, alert, 'alert.acknowledged');
          await deliverAlertWebhooks(auth, alert, 'alert.acknowledged');
        }
        return new Response(JSON.stringify(alert), { headers: buildHeaders(req) });
      }

      if (body.action === 'resolve') {
        const [alert] = await sql`
          UPDATE alert_events
          SET status = 'resolved', resolved_at = COALESCE(resolved_at, now()), resolved_by = ${auth.userId}
          WHERE id = ${body.id} AND organization_id = ${auth.orgId}
          RETURNING *
        `;
        if (alert) {
          await deliverSlackAlerts(auth, alert, 'alert.resolved');
          await deliverAlertWebhooks(auth, alert, 'alert.resolved');
        }
        return new Response(JSON.stringify(alert), { headers: buildHeaders(req) });
      }

      return new Response(JSON.stringify({ error: 'Unsupported action' }), { status: 400, headers: buildHeaders(req) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: buildHeaders(req) });
  } catch (error: any) {
    const status = /Admin access required|Access denied/.test(error?.message || '') ? 403 : 500;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to process alerts' }), { status, headers: buildHeaders(req) });
  }
};

export const config: Config = {
  path: '/api/alerts',
};
