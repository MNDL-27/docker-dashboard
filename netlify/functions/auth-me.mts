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
    const authContext = await requireAuth(req, { requireOrg: false, requireApproved: false });

    const users = await sql`
      SELECT 
        u.id, u.email, u.full_name, u.avatar_url, u.is_approved,
        EXISTS(SELECT 1 FROM organization_members om WHERE om.user_id = u.id) as has_orgs
      FROM users u
      WHERE u.id = ${authContext.userId}
    `;

    if (users.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
    }

    return new Response(JSON.stringify({ user: users[0] }), { headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/auth/me',
};
