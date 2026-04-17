import type { Config } from '@netlify/functions';
import { requireAuth } from './lib/auth.mjs';
import { sql } from './lib/db.mjs';
import { ensureAlertsSchema } from './lib/ensure-alerts-schema.mjs';
import { ensureDefaultAlertRules, listAlertRules, requireOrganizationAdmin, syncAlertEvents } from './lib/alerts.mjs';
import { assertAdvancedAlertsAccessAllowed } from './lib/access-controls.mjs';

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
      await ensureDefaultAlertRules(auth);
      return new Response(JSON.stringify(await listAlertRules(auth)), { headers });
    }

    if (req.method === 'POST') {
      await requireOrganizationAdmin(auth);
      await assertAdvancedAlertsAccessAllowed({ organizationId: auth.orgId, isPlatformAdmin: auth.isPlatformAdmin });
      const body = await req.json();

      const [rule] = await sql`
        INSERT INTO alert_rules (
          organization_id, name, condition_type, resource_scope, threshold_value,
          threshold_window_minutes, severity, notification_channels, enabled, created_by
        )
        VALUES (
          ${auth.orgId}, ${body.name}, ${body.condition_type},
          ${JSON.stringify(body.resource_scope || { scope: 'organization' })},
          ${body.threshold_value ?? null},
          ${body.threshold_window_minutes ?? 5},
          ${body.severity},
          ${JSON.stringify(body.notification_channels || [])},
          ${body.enabled ?? true},
          ${auth.userId}
        )
        RETURNING *
      `;

      await syncAlertEvents(auth);
      return new Response(JSON.stringify(rule), { status: 201, headers });
    }

    if (req.method === 'PATCH') {
      await requireOrganizationAdmin(auth);
      await assertAdvancedAlertsAccessAllowed({ organizationId: auth.orgId, isPlatformAdmin: auth.isPlatformAdmin });
      const body = await req.json();
      if (!body?.id) {
        return new Response(JSON.stringify({ error: 'Rule id required' }), { status: 400, headers });
      }

      const currentRows = await sql`
        SELECT *
        FROM alert_rules
        WHERE id = ${body.id} AND organization_id = ${auth.orgId}
        LIMIT 1
      `;

      if (currentRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), { status: 404, headers });
      }

      const current = currentRows[0];
      const [rule] = await sql`
        UPDATE alert_rules
        SET
          name = ${body.name ?? current.name},
          condition_type = ${body.condition_type ?? current.condition_type},
          resource_scope = ${JSON.stringify(body.resource_scope ?? current.resource_scope)},
          threshold_value = ${Object.prototype.hasOwnProperty.call(body, 'threshold_value') ? body.threshold_value : current.threshold_value},
          threshold_window_minutes = ${body.threshold_window_minutes ?? current.threshold_window_minutes},
          severity = ${body.severity ?? current.severity},
          notification_channels = ${JSON.stringify(body.notification_channels ?? current.notification_channels)},
          enabled = ${Object.prototype.hasOwnProperty.call(body, 'enabled') ? body.enabled : current.enabled}
        WHERE id = ${body.id} AND organization_id = ${auth.orgId}
        RETURNING *
      `;

      await syncAlertEvents(auth);
      return new Response(JSON.stringify(rule), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error: any) {
    const status = /Admin access required|Access denied/.test(error?.message || '') ? 403 : 500;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to process alert rules' }), { status, headers });
  }
};

export const config: Config = {
  path: '/api/alert-rules',
};
