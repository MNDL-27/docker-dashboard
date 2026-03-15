import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { getUserFromHeader } from './lib/auth.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function sanitizeContainerId(id: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$/.test(id)) {
    throw new Error('Invalid container ID format');
  }
  return id;
}

function buildRequest(
  host: { host_url: string; connection_mode: string; docker_socket_path: string },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
  dockerPath: string,
  method: string,
) {
  const base = host.host_url.replace(/\/$/, '');
  const reqHeaders: Record<string, string> = {};

  const url = `${base}/docker${dockerPath}`;

  if (secrets?.agent_api_key) {
    reqHeaders['X-Agent-Key'] = secrets.agent_api_key;
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    reqHeaders['X-Docker-Socket'] = host.docker_socket_path;
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) reqHeaders['CF-Access-Client-Id'] = secrets.cf_service_token_id;
    if (secrets?.cf_service_token_secret) reqHeaders['CF-Access-Client-Secret'] = secrets.cf_service_token_secret;
  }

  return { url, method, headers: reqHeaders };
}

async function dockerFetch(url: string, method: string, reqHeaders: Record<string, string>, timeoutMs = 30000) {
  return await fetch(url, {
    method,
    headers: reqHeaders,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const user = getUserFromHeader(req.headers.get('Authorization'));
    const body = await req.json();
    const { action, hostId, orgId, containerId, params } = body;

    // ── Org-wide: fetch containers from all hosts ──
    if (action === 'all-containers') {
      if (!orgId) return new Response(JSON.stringify({ error: 'orgId required' }), { status: 400, headers });

      const memberships = await sql`
        SELECT 1 FROM organization_members WHERE organization_id = ${orgId} AND user_id = ${user.id}
      `;
      if (memberships.length === 0) return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers });

      const hosts = await sql`SELECT * FROM docker_hosts WHERE organization_id = ${orgId}`;

      const allContainers: any[] = [];
      for (const host of hosts) {
        try {
          const secretsRecord = await sql`
            SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
            FROM docker_host_secrets WHERE host_id = ${host.id}
          `;
          const secrets = secretsRecord[0] || null;

          const { url, method, headers: reqHeaders } = buildRequest(host as any, secrets, '/containers/json?all=true', 'GET');
          const resp = await dockerFetch(url, method, reqHeaders, 10000);
          if (resp.ok) {
            const containers = await resp.json();
            allContainers.push(...containers.map((c: any) => ({ ...c, _hostId: host.id, _hostName: host.name })));
            await sql`UPDATE docker_hosts SET status = 'connected', last_seen_at = now() WHERE id = ${host.id}`;
          } else {
            await sql`UPDATE docker_hosts SET status = 'error' WHERE id = ${host.id}`;
          }
        } catch (_e) {
          await sql`UPDATE docker_hosts SET status = 'error' WHERE id = ${host.id}`;
        }
      }

      return new Response(JSON.stringify(allContainers), { headers });
    }

    // ── Host-specific actions ──
    if (!hostId) return new Response(JSON.stringify({ error: 'hostId required' }), { status: 400, headers });

    const hostRecords = await sql`
      SELECT h.* FROM docker_hosts h
      JOIN organization_members om ON h.organization_id = om.organization_id
      WHERE h.id = ${hostId} AND om.user_id = ${user.id}
    `;

    if (hostRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Host not found or access denied' }), { status: 404, headers });
    }
    const host = hostRecords[0];

    const secretsRecord = await sql`
      SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
      FROM docker_host_secrets WHERE host_id = ${hostId}
    `;
    const secrets = secretsRecord[0] || null;

    let dockerPath: string;
    let method = 'GET';

    switch (action) {
      case 'ping': dockerPath = '/_ping'; break;
      case 'info': dockerPath = '/info'; break;
      case 'version': dockerPath = '/version'; break;
      case 'containers': dockerPath = '/containers/json?all=true'; break;
      case 'container-inspect': 
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers });
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/json`; 
        break;
      case 'container-stats': 
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers });
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/stats?stream=false`; 
        break;
      case 'container-logs': 
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers });
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/logs?stdout=true&stderr=true&tail=${params?.tail || 100}&timestamps=true`; 
        break;
      case 'container-start': 
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers });
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/start`; method = 'POST'; 
        break;
      case 'container-stop': 
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers });
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/stop`; method = 'POST'; 
        break;
      case 'container-restart': 
        if (!containerId) return new Response(JSON.stringify({ error: 'containerId required' }), { status: 400, headers });
        dockerPath = `/containers/${sanitizeContainerId(containerId)}/restart`; method = 'POST'; 
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers });
    }

    const reqData = buildRequest(host as any, secrets, dockerPath, method);
    const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers);

    if (action === 'ping') {
      const text = await dockerResponse.text();
      const ok = dockerResponse.ok;

      let dockerVersion = null;
      let osInfo = null;
      try {
        const vReq = buildRequest(host as any, secrets, '/version', 'GET');
        const vResp = await dockerFetch(vReq.url, vReq.method, vReq.headers, 5000);
        if (vResp.ok) {
          const vData = await vResp.json();
          dockerVersion = vData.Version || null;
          osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null;
        }
      } catch (_) {}

      await sql`
        UPDATE docker_hosts 
        SET status = ${ok ? 'connected' : 'error'}, 
            last_seen_at = now(),
            docker_version = COALESCE(${dockerVersion}, docker_version),
            os_info = COALESCE(${osInfo}, os_info)
        WHERE id = ${hostId}
      `;

      return new Response(JSON.stringify({
        ok, status: text, docker_version: dockerVersion, os_info: osInfo, connection_mode: host.connection_mode
      }), { headers });
    }

    if (action === 'container-logs') {
      const rawBytes = new Uint8Array(await dockerResponse.arrayBuffer());
      const lines: string[] = [];
      let offset = 0;
      while (offset + 8 <= rawBytes.length) {
        const size = (rawBytes[offset + 4] << 24) | (rawBytes[offset + 5] << 16) | (rawBytes[offset + 6] << 8) | rawBytes[offset + 7];
        offset += 8;
        if (offset + size <= rawBytes.length) {
          lines.push(new TextDecoder().decode(rawBytes.slice(offset, offset + size)).trimEnd());
        }
        offset += size;
      }
      if (lines.length === 0) lines.push(...(new TextDecoder().decode(rawBytes)).split('\n').filter(Boolean));
      return new Response(JSON.stringify({ logs: lines }), { headers });
    }

    if (['container-start', 'container-stop', 'container-restart'].includes(action)) {
      const text = await dockerResponse.text();
      const ok = dockerResponse.status === 204 || dockerResponse.status === 304 || dockerResponse.ok;
      return new Response(JSON.stringify({ ok, status: dockerResponse.status, message: text }), { headers });
    }

    if (!dockerResponse.ok) {
      return new Response(JSON.stringify({ error: `Docker API error: ${dockerResponse.status}`, details: await dockerResponse.text() }), { status: 502, headers });
    }

    return new Response(JSON.stringify(await dockerResponse.json()), { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Docker connection failed', details: error.message }), { status: 502, headers });
  }
};

export const config: Config = {
  path: '/api/docker-proxy',
};
