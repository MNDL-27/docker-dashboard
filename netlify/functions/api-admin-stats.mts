import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Simple admin email list for v1 security.
// In a real app, this would be a db column (e.g., users.is_superadmin).
const ADMIN_EMAILS = [
  'protikmndl27@gmail.com',
  'protikmondal27@gmail.com'
];

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const auth = await requireAuth(req, { requireApproved: false });
    if (!auth.userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    // Verify user is an admin
    const user = await sql`SELECT email, is_approved FROM users WHERE id = ${auth.userId}`;
    if (!user.length || !ADMIN_EMAILS.includes(user[0].email.toLowerCase())) {
       return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), { status: 403, headers });
    }

    const orgQuery = await sql`SELECT count(*) as count FROM organizations`;
    const userQuery = await sql`SELECT count(*) as count FROM users`;
    const hostQuery = await sql`SELECT count(*) as count FROM docker_hosts WHERE status = 'connected'`;

    return new Response(JSON.stringify({ 
      success: true, 
      stats: {
        totalOrgs: parseInt(orgQuery[0].count, 10),
        totalUsers: parseInt(userQuery[0].count, 10),
        activeHosts: parseInt(hostQuery[0].count, 10)
      }
    }), { headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config: Config = {
  path: '/api/admin/stats',
};
