import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { assertHostProxyAllowed, assertOrganizationNodeCapacityAvailable, assertOrganizationWriteAllowed, enforceOrganizationNodeLimit } from './lib/access-controls.mjs';
import { decryptHostSecrets, encryptSecret } from './lib/crypto.mjs';
import { ensureOnboardingSchema } from './lib/ensure-onboarding-schema.mjs';
import { parseStaleThresholdMinutes, staleCutoffDate } from './lib/host-health.mjs';
import { normalizeAndValidateHostUrl } from './lib/host-url.mjs';

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
    const staleThresholdMinutes = parseStaleThresholdMinutes(process.env.HOST_STALE_THRESHOLD_MINUTES);
    const staleCutoff = staleCutoffDate(new Date(), staleThresholdMinutes).toISOString();

    async function requireOrgAdmin(targetOrgId: string) {
      await assertOrganizationWriteAllowed({
        organizationId: targetOrgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      const members = await sql`
        SELECT role FROM organization_members
        WHERE organization_id = ${targetOrgId} AND user_id = ${auth.userId}
      `;

      if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
        return false;
      }

      return true;
    }

    if (req.method === 'GET') {
      if (hostId) {
        await sql`
          UPDATE docker_hosts h
          SET status = 'stale'
          FROM organization_members om
          WHERE h.id = ${hostId}
            AND h.organization_id = om.organization_id
            AND om.user_id = ${auth.userId}
            AND h.status = 'connected'
            AND h.last_seen_at IS NOT NULL
            AND h.last_seen_at < ${staleCutoff}
        `;

        const hosts = await sql`
          SELECT h.* FROM docker_hosts h
          JOIN organization_members om ON h.organization_id = om.organization_id
          WHERE h.id = ${hostId} AND om.user_id = ${auth.userId}
        `;
        if (hosts.length === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });

        const limitState = await enforceOrganizationNodeLimit({
          organizationId: hosts[0].organization_id,
          isPlatformAdmin: auth.isPlatformAdmin,
        });

        if (!limitState.allowedHostIds.includes(hostId)) {
          return new Response(
            JSON.stringify({ error: 'This host is over your current plan limit. Remove extra hosts or upgrade to reactivate it.' }),
            { status: 402, headers },
          );
        }

        const includeSecrets = url.searchParams.get('includeSecrets') === 'true';
        if (!includeSecrets) {
          return new Response(JSON.stringify(hosts[0]), { headers });
        }

        const isAdmin = await requireOrgAdmin(hosts[0].organization_id);
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required for active org' }), { status: 403, headers });
        }

        const secretsRecord = await sql`
          SELECT agent_api_key, cf_service_token_id, cf_service_token_secret
          FROM docker_host_secrets
          WHERE host_id = ${hostId}
        `;
        const secrets = decryptHostSecrets(secretsRecord[0] || null, hostId);

        return new Response(JSON.stringify({
          ...hosts[0],
          secrets: {
            agentApiKey: secrets?.agent_api_key || '',
            cfServiceTokenId: secrets?.cf_service_token_id || '',
            cfServiceTokenSecret: secrets?.cf_service_token_secret || '',
          },
        }), { headers });
      }

      if (!orgId) return new Response(JSON.stringify({ error: 'Active org required' }), { status: 400, headers });

      await enforceOrganizationNodeLimit({
        organizationId: orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      await sql`
        UPDATE docker_hosts
        SET status = 'stale'
        WHERE organization_id = ${orgId}
          AND status = 'connected'
          AND last_seen_at IS NOT NULL
          AND last_seen_at < ${staleCutoff}
      `;

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
      if (!orgId) return new Response(JSON.stringify({ error: 'Active org required' }), { status: 400, headers });
      const isAdmin = await requireOrgAdmin(orgId);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required for active org' }), { status: 403, headers });
      }
      await assertOrganizationNodeCapacityAvailable({
        organizationId: orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });
      let hostUrl: string;
      try {
        hostUrl = normalizeAndValidateHostUrl(String(body.host_url ?? ""));
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message || 'Invalid host_url' }), { status: 400, headers });
      }

      const [host] = await sql`
        INSERT INTO docker_hosts (organization_id, name, host_url, connection_mode, docker_socket_path, created_by, status)
        VALUES (${orgId}, ${body.name}, ${hostUrl}, ${body.connection_mode}, ${body.docker_socket_path || '/var/run/docker.sock'}, ${auth.userId}, 'unknown')
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

    if (req.method === 'PATCH') {
      if (!hostId) return new Response(JSON.stringify({ error: 'hostId required' }), { status: 400, headers });
      await assertHostProxyAllowed({ hostId, isPlatformAdmin: auth.isPlatformAdmin });

      const hostRecords = await sql`
        SELECT h.* FROM docker_hosts h
        JOIN organization_members om ON h.organization_id = om.organization_id
        WHERE h.id = ${hostId} AND om.user_id = ${auth.userId}
      `;

      if (hostRecords.length === 0) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
      }

      const host = hostRecords[0];
      const isAdmin = await requireOrgAdmin(host.organization_id);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required for active org' }), { status: 403, headers });
      }

      const body = await req.json();
      let hostUrl: string;
      try {
        hostUrl = normalizeAndValidateHostUrl(String(body.host_url ?? ""));
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message || 'Invalid host_url' }), { status: 400, headers });
      }

      const [updatedHost] = await sql`
        UPDATE docker_hosts
        SET
          name = ${body.name},
          host_url = ${hostUrl},
          connection_mode = ${body.connection_mode},
          docker_socket_path = ${body.docker_socket_path || '/var/run/docker.sock'},
          updated_at = now()
        WHERE id = ${hostId}
        RETURNING *
      `;

      if (body.secrets) {
        const encryptedAgentKey = body.secrets.agentApiKey ? encryptSecret(body.secrets.agentApiKey, host.id, 'agent_api_key') : null;
        const encryptedCfId = body.secrets.cfServiceTokenId ? encryptSecret(body.secrets.cfServiceTokenId, host.id, 'cf_service_token_id') : null;
        const encryptedCfSecret = body.secrets.cfServiceTokenSecret ? encryptSecret(body.secrets.cfServiceTokenSecret, host.id, 'cf_service_token_secret') : null;

        await sql`
          INSERT INTO docker_host_secrets (host_id, agent_api_key, cf_service_token_id, cf_service_token_secret)
          VALUES (${host.id}, ${encryptedAgentKey}, ${encryptedCfId}, ${encryptedCfSecret})
          ON CONFLICT (host_id)
          DO UPDATE SET
            agent_api_key = EXCLUDED.agent_api_key,
            cf_service_token_id = EXCLUDED.cf_service_token_id,
            cf_service_token_secret = EXCLUDED.cf_service_token_secret
        `;
      }

      return new Response(JSON.stringify(updatedHost), { headers });
    }

    if (req.method === 'DELETE') {
      if (!hostId) return new Response(JSON.stringify({ error: 'hostId required' }), { status: 400, headers });
      await assertHostProxyAllowed({ hostId, isPlatformAdmin: auth.isPlatformAdmin });
      
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
