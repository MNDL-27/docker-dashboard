import type { Config } from '@netlify/functions';

import { requireAuth } from './lib/auth.mjs';
import { ensureAlertsSchema } from './lib/ensure-alerts-schema.mjs';
import { getOrganizationRole, requireOrganizationAdmin } from './lib/alerts.mjs';
import {
  createWebhookDestination,
  listWebhookDestinations,
  sendWebhookDestinationTest,
  updateWebhookDestination,
} from './lib/webhook-destinations.mjs';

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
    const role = await getOrganizationRole(auth);

    if (req.method === 'GET') {
      const destinations = await listWebhookDestinations(auth);
      return new Response(JSON.stringify({ destinations, role, can_manage: ['owner', 'admin'].includes(role) }), { headers });
    }

    if (req.method === 'POST') {
      await requireOrganizationAdmin(auth);
      const body = await req.json();

      if (body?.action === 'test') {
        if (!body?.id) {
          return new Response(JSON.stringify({ error: 'Destination id required' }), { status: 400, headers });
        }
        const attempt = await sendWebhookDestinationTest(auth, body.id);
        return new Response(JSON.stringify(attempt), { headers });
      }

      if (!body?.name?.trim() || !body?.url?.trim()) {
        return new Response(JSON.stringify({ error: 'Name and URL are required' }), { status: 400, headers });
      }

      const result = await createWebhookDestination(auth, {
        name: body.name.trim(),
        url: body.url.trim(),
        enabled: body.enabled ?? true,
      });
      return new Response(JSON.stringify(result), { status: 201, headers });
    }

    if (req.method === 'PATCH') {
      await requireOrganizationAdmin(auth);
      const body = await req.json();
      if (!body?.id) {
        return new Response(JSON.stringify({ error: 'Destination id required' }), { status: 400, headers });
      }

      const result = await updateWebhookDestination(auth, {
        id: body.id,
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        url: typeof body.url === 'string' ? body.url.trim() : undefined,
        enabled: Object.prototype.hasOwnProperty.call(body, 'enabled') ? body.enabled : undefined,
        regenerate_secret: !!body.regenerate_secret,
      });

      return new Response(JSON.stringify(result), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error: any) {
    const status = /Admin access required|Access denied/.test(error?.message || '')
      ? 403
      : /URL must|URL cannot/.test(error?.message || '')
        ? 400
        : 500;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to process webhook destinations' }), { status, headers });
  }
};

export const config: Config = {
  path: '/api/webhook-destinations',
};
