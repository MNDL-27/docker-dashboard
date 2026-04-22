import type { Config } from '@netlify/functions';

import { requireAuth } from './lib/auth.mjs';
import { assertOrganizationFeatureAllowed } from './lib/access-controls.mjs';
import { ensureAlertsSchema } from './lib/ensure-alerts-schema.mjs';
import { getOrganizationRole, requireOrganizationAdmin } from './lib/alerts.mjs';
import {
  createSlackDestination,
  listSlackDestinations,
  sendSlackDestinationTest,
  updateSlackDestination,
} from './lib/slack-delivery.mjs';

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
    await assertOrganizationFeatureAllowed({
      organizationId: auth.orgId!,
      isPlatformAdmin: auth.isPlatformAdmin,
      feature: 'slack_destinations',
    });
    const role = await getOrganizationRole(auth);

    if (req.method === 'GET') {
      const destinations = await listSlackDestinations(auth);
      return new Response(JSON.stringify({ destinations, role, can_manage: ['owner', 'admin'].includes(role) }), { headers });
    }

    if (req.method === 'POST') {
      await requireOrganizationAdmin(auth);
      const body = await req.json();

      if (body?.action === 'test') {
        if (!body?.id) {
          return new Response(JSON.stringify({ error: 'Destination id required' }), { status: 400, headers });
        }
        const attempt = await sendSlackDestinationTest(auth, body.id);
        return new Response(JSON.stringify(attempt), { headers });
      }

      if (!body?.name?.trim() || !body?.webhook_url?.trim()) {
        return new Response(JSON.stringify({ error: 'Name and Slack webhook URL are required' }), { status: 400, headers });
      }

      const destination = await createSlackDestination(auth, {
        name: body.name.trim(),
        webhook_url: body.webhook_url.trim(),
        enabled: body.enabled ?? true,
      });
      return new Response(JSON.stringify(destination), { status: 201, headers });
    }

    if (req.method === 'PATCH') {
      await requireOrganizationAdmin(auth);
      const body = await req.json();
      if (!body?.id) {
        return new Response(JSON.stringify({ error: 'Destination id required' }), { status: 400, headers });
      }

      const destination = await updateSlackDestination(auth, {
        id: body.id,
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        webhook_url: typeof body.webhook_url === 'string' ? body.webhook_url.trim() : undefined,
        enabled: Object.prototype.hasOwnProperty.call(body, 'enabled') ? body.enabled : undefined,
      });
      return new Response(JSON.stringify(destination), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error: any) {
    const status = /Admin access required|Access denied/.test(error?.message || '')
      ? 403
      : /Slack webhook URL|URL must|URL cannot/.test(error?.message || '')
        ? 400
        : 500;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to process Slack destinations' }), { status, headers });
  }
};

export const config: Config = {
  path: '/api/slack-destinations',
};
