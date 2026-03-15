import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { getUserFromHeader } from './lib/auth.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const user = getUserFromHeader(req.headers.get('Authorization'));
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'orgId required' }), { status: 400, headers });
    }

    const members = await sql`
      SELECT u.id as user_id, u.full_name, u.avatar_url, om.role, om.created_at as joined_at
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
      AND EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = ${orgId} AND user_id = ${user.id}
      )
    `;

    return new Response(JSON.stringify(members), { headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/members',
};
