import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';

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
    const authContext = await requireAuth(req, { requireOrg: false });

    if (req.method === 'GET') {
      const orgs = await sql`
        SELECT o.* 
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ${authContext.userId}
        ORDER BY o.created_at ASC
      `;
      return new Response(JSON.stringify(orgs), { headers });
    }

    if (req.method === 'POST') {
      const { name } = await req.json();
      if (!name) return new Response(JSON.stringify({ error: 'Name required' }), { status: 400, headers });

      const [{ create_organization: orgId }] = await sql`
        SELECT public.create_organization(${name}, ${authContext.userId})
      `;

      return new Response(JSON.stringify({ id: orgId }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/organizations',
};
