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
    const hostId = url.searchParams.get('hostId');

    if (req.method === 'GET') {
      if (hostId) {
        const hosts = await sql`
          SELECT h.* FROM docker_hosts h
          JOIN organization_members om ON h.organization_id = om.organization_id
          WHERE h.id = ${hostId} AND om.user_id = ${user.id}
        `;
        if (hosts.length === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
        return new Response(JSON.stringify(hosts[0]), { headers });
      }

      if (!orgId) return new Response(JSON.stringify({ error: 'orgId required' }), { status: 400, headers });

      const hosts = await sql`
        SELECT h.* FROM docker_hosts h
        JOIN organization_members om ON h.organization_id = om.organization_id
        WHERE h.organization_id = ${orgId} AND om.user_id = ${user.id}
        ORDER BY h.created_at DESC
      `;
      return new Response(JSON.stringify(hosts), { headers });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      
      // Check org admin
      const members = await sql`
        SELECT role FROM organization_members 
        WHERE organization_id = ${body.organization_id} AND user_id = ${user.id}
      `;
      if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
      }

      const [host] = await sql`
        INSERT INTO docker_hosts (organization_id, name, host_url, connection_mode, docker_socket_path, created_by, status)
        VALUES (${body.organization_id}, ${body.name}, ${body.host_url}, ${body.connection_mode}, ${body.docker_socket_path || '/var/run/docker.sock'}, ${user.id}, 'unknown')
        RETURNING *
      `;

      if (body.secrets) {
        await sql`
          INSERT INTO docker_host_secrets (host_id, agent_api_key, cf_service_token_id, cf_service_token_secret)
          VALUES (${host.id}, ${body.secrets.agentApiKey || null}, ${body.secrets.cfServiceTokenId || null}, ${body.secrets.cfServiceTokenSecret || null})
        `;
      }

      return new Response(JSON.stringify(host), { headers });
    }

    if (req.method === 'DELETE') {
      if (!hostId) return new Response(JSON.stringify({ error: 'hostId required' }), { status: 400, headers });
      
      // Delete will cascade to secrets, but we must verify org admin first
      await sql`
        DELETE FROM docker_hosts
        WHERE id = ${hostId} AND EXISTS (
          SELECT 1 FROM organization_members 
          WHERE organization_id = docker_hosts.organization_id 
          AND user_id = ${user.id} AND role IN ('owner', 'admin')
        )
      `;
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/docker-hosts',
};
