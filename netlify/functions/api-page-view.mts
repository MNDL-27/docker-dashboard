import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { buildCorsHeaders } from './lib/security.mjs';
import { ensurePageViewsSchema } from './lib/ensure-page-views-schema.mjs';

const ACTIVE_WINDOW_MINUTES = 2;

export default async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      await ensurePageViewsSchema();
      const auth = await requireAuth(req, { requireOrg: false });
      const body = await req.json().catch(() => ({}));
      const path = typeof body.path === 'string' && body.path ? body.path.substring(0, 512) : '/';

      await sql`
        INSERT INTO public.page_views (user_id, organization_id, path, last_active_at)
        VALUES (${auth.userId}, ${auth.orgId}, ${path}, now())
        ON CONFLICT (user_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET
          path = EXCLUDED.path,
          last_active_at = now()
      `;

      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    if (req.method === 'GET') {
      const [row] = await sql<{ count: string }[]>`
        SELECT count(*)::text AS count
        FROM public.page_views
        WHERE last_active_at > now() - make_interval(mins => ${ACTIVE_WINDOW_MINUTES})
      `;

      return new Response(JSON.stringify({
        success: true,
        active_users: Number(row?.count || '0'),
        window_minutes: ACTIVE_WINDOW_MINUTES,
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const lower = message.toLowerCase();
    const status = lower.includes('unauthorized') ? 401 : lower.includes('forbidden') ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
};

export const config: Config = {
  path: '/api/page-view',
};
