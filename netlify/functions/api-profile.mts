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

    if (req.method === 'PUT') {
      const { full_name } = await req.json();
      
      const updated = await sql`
        UPDATE users 
        SET full_name = ${full_name} 
        WHERE id = ${user.id}
        RETURNING id, email, full_name, avatar_url
      `;
      
      return new Response(JSON.stringify(updated[0]), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/profile',
};
