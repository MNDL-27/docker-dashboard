import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { assertOrganizationFeatureAllowed } from './lib/access-controls.mjs';


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    const authContext = await requireAuth(req);
    const url = new URL(req.url);
    
    // Use the orgId from the Clerk active organization token context, or fallback to query param
    const orgId = authContext.orgId || url.searchParams.get('orgId');

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: buildHeaders(req) });
    }
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'orgId required' }), { status: 400, headers: buildHeaders(req) });
    }

    await assertOrganizationFeatureAllowed({
      organizationId: orgId,
      isPlatformAdmin: authContext.isPlatformAdmin,
      feature: 'team_collaboration',
    });

    const members = await sql`
      SELECT u.id as user_id, u.full_name, u.avatar_url, om.role, om.created_at as joined_at
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
      AND EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = ${orgId} AND user_id = ${authContext.userId}
      )
    `;

    return new Response(JSON.stringify(members), { headers: buildHeaders(req) });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers: buildHeaders(req) });
  }
};

export const config: Config = {
  path: '/api/members',
};
