import type { Config } from '@netlify/functions';
import { requireAuth } from './lib/auth.mjs';
import { sql } from './lib/db.mjs';

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
    const auth = await requireAuth(req);

    if (req.method === 'GET') {
      const users = await sql`SELECT email, full_name, avatar_url FROM users WHERE id = ${auth.userId}`;
      if (!users.length) return new Response('User not sync', { status: 404 });
      return new Response(JSON.stringify(users[0]), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/profile',
};
