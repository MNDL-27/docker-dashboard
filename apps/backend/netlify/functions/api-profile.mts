import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import { requireAuth } from './lib/auth.mjs';
import { sql } from './lib/db.mjs';


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    const auth = await requireAuth(req);

    if (req.method === 'GET') {
      const users = await sql`SELECT email, full_name, avatar_url FROM users WHERE id = ${auth.userId}`;
      if (!users.length) return new Response('User not sync', { status: 404 });
      return new Response(JSON.stringify(users[0]), { headers: buildHeaders(req) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: buildHeaders(req) });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers: buildHeaders(req) });
  }
};

export const config: Config = {
  path: '/api/profile',
};
