import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { encryptSecret } from './lib/crypto.mjs';
import { ensureOnboardingSchema } from './lib/ensure-onboarding-schema.mjs';

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
    await ensureOnboardingSchema();
    const auth = await requireAuth(req);
    const url = new URL(req.url);
    const hostId = url.searchParams.get('hostId');
    const orgId = auth.orgId; // Clerk active org handles isolation

    if (req.method === 'GET') {
      if (hostId) {
        const hosts = await sql`
          SELECT h.* FROM docker_hosts h
          JOIN organization_members om ON h.organization_id = om.organization_id
          WHERE h.id = ${hostId} AND om.user_id = ${auth.userId}
        `;
        if (hosts.length === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
        return new Response(JSON.stringify(hosts[0]), { headers });
      }

      if (!orgId) return new Response(JSON.stringify({ error: 'Active org required' }), { status: 400, headers });

      const hosts = await sql`
        SELECT h.* FROM docker_hosts h
        JOIN organization_members om ON h.organization_id = om.organization_id
        WHERE h.organization_id = ${orgId} AND om.user_id = ${auth.userId}
        ORDER BY h.created_at DESC
      `;
      return new Response(JSON.stringify(hosts), { headers });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      
      const members = await sql`
        SELECT role FROM organization_members 
        WHERE organization_id = ${orgId} AND user_id = ${auth.userId}
      `;
      if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
        return new Response(JSON.stringify({ error: 'Admin access required for active org' }), { status: 403, headers });
      }

      const [host] = await sql`
        INSERT INTO docker_hosts (organization_id, name, host_url, connection_mode, docker_socket_path, created_by, status)
        VALUES (${orgId}, ${body.name}, ${body.host_url}, ${body.connection_mode}, ${body.docker_socket_path || '/var/run/docker.sock'}, ${auth.userId}, 'unknown')
        RETURNING *
      `;

      // Host exists => onboarding is completed for this org.
      await sql`
        UPDATE organizations
        SET
          onboarding_status = 'completed',
          onboarding_completed_at = COALESCE(onboarding_completed_at, now())
        WHERE id = ${orgId}
      `;

      if (body.secrets) {
        const encryptedAgentKey = body.secrets.agentApiKey ? encryptSecret(body.secrets.agentApiKey, host.id, 'agent_api_key') : null;
        const encryptedCfId = body.secrets.cfServiceTokenId ? encryptSecret(body.secrets.cfServiceTokenId, host.id, 'cf_service_token_id') : null;
        const encryptedCfSecret = body.secrets.cfServiceTokenSecret ? encryptSecret(body.secrets.cfServiceTokenSecret, host.id, 'cf_service_token_secret') : null;

        await sql`
          INSERT INTO docker_host_secrets (host_id, agent_api_key, cf_service_token_id, cf_service_token_secret)
          VALUES (${host.id}, ${encryptedAgentKey}, ${encryptedCfId}, ${encryptedCfSecret})
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
          AND user_id = ${auth.userId} AND role IN ('owner', 'admin')
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
