import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import {
  DEFAULT_UNHEALTHY_THRESHOLD,
  parseStaleThresholdMinutes,
  staleCutoffDate,
  failureStatusForCount,
} from './lib/host-health.mjs';
import { CURRENT_WATCHTOWER_AGENT_VERSION, isAgentVersionOutdated } from './lib/agent-version.mts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-cron-secret',
  'Content-Type': 'application/json'
};

const PING_TIMEOUT_MS = 10000

function buildPingRequest(
  host: { host_url: string; connection_mode: string; docker_socket_path: string | null },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
) {
  const base = host.host_url.replace(/\/$/, '')
  const reqHeaders: Record<string, string> = {}

  if (secrets?.agent_api_key) {
    reqHeaders['X-Agent-Key'] = secrets.agent_api_key
  }

  if (host.docker_socket_path && host.docker_socket_path !== '/var/run/docker.sock') {
    reqHeaders['X-Docker-Socket'] = host.docker_socket_path
  }

  if (host.connection_mode === 'cloudflare_tunnel') {
    if (secrets?.cf_service_token_id) reqHeaders['CF-Access-Client-Id'] = secrets.cf_service_token_id
    if (secrets?.cf_service_token_secret) reqHeaders['CF-Access-Client-Secret'] = secrets.cf_service_token_secret
  }

  return {
    pingUrl: `${base}/docker/_ping`,
    dockerVersionUrl: `${base}/docker/version`,
    agentVersionUrl: `${base}/agent/version`,
    headers: reqHeaders
  }
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedSecret = process.env.HEALTH_POLL_SECRET

    if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
    }

    const hosts = await sql`SELECT * FROM docker_hosts`;

    const staleThresholdMinutes = parseStaleThresholdMinutes(process.env.HOST_STALE_THRESHOLD_MINUTES)
    const staleCutoff = staleCutoffDate(new Date(), staleThresholdMinutes)

    const staleUpdate = await sql`
      UPDATE docker_hosts
      SET status = 'stale'
      WHERE status = 'connected'
        AND last_seen_at IS NOT NULL
        AND last_seen_at < ${staleCutoff.toISOString()}
      RETURNING id
    `

    if (hosts.length === 0) {
      return new Response(JSON.stringify({ polled: 0, message: 'No hosts to poll' }), { headers })
    }

    const results: any[] = []

    await Promise.allSettled(hosts.map(async (host) => {
      try {
        const secretsRecord = await sql`
          SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
          FROM docker_host_secrets WHERE host_id = ${host.id}
        `;
        const secrets = secretsRecord[0] || null;

        const { pingUrl, dockerVersionUrl, agentVersionUrl, headers: reqHeaders } = buildPingRequest(host as any, secrets)

        const pingResp = await fetch(pingUrl, {
          method: 'GET',
          headers: reqHeaders,
          signal: AbortSignal.timeout(PING_TIMEOUT_MS),
        })

        if (!pingResp.ok) {
          throw new Error(`Ping returned ${pingResp.status}: ${await pingResp.text()}`)
        }
        await pingResp.text()

        let dockerVersion: string | null = null
        let agentVersion: string | null = null
        let osInfo: string | null = null
        try {
          const vResp = await fetch(dockerVersionUrl, { headers: reqHeaders, signal: AbortSignal.timeout(5000) })
          if (vResp.ok) {
            const vData = await vResp.json()
            dockerVersion = vData.Version || null
            osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null
          }
        } catch (_) {}

        try {
          const agentResp = await fetch(agentVersionUrl, { headers: reqHeaders, signal: AbortSignal.timeout(5000) })
          if (agentResp.ok) {
            const agentData = await agentResp.json()
            agentVersion = agentData.agent_version || agentData.version || null
          }
        } catch (_) {}

        const agentNeedsUpdate = !!agentVersion && isAgentVersionOutdated(agentVersion)

        await sql`
          UPDATE docker_hosts 
          SET status = 'connected', 
              last_seen_at = now(), 
              consecutive_failures = 0, 
              last_error = null,
              docker_version = COALESCE(${dockerVersion}, docker_version),
              agent_version = COALESCE(${agentVersion}, agent_version),
              os_info = COALESCE(${osInfo}, os_info)
          WHERE id = ${host.id}
        `;

        results.push({
          hostId: host.id,
          name: host.name,
          status: 'connected',
          docker_version: dockerVersion,
          agent_version: agentVersion,
          agent_update_available: agentNeedsUpdate,
          current_agent_version: CURRENT_WATCHTOWER_AGENT_VERSION,
        })
      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error'
        const newFailures = (host.consecutive_failures || 0) + 1
        const newStatus = failureStatusForCount(newFailures, DEFAULT_UNHEALTHY_THRESHOLD)

        await sql`
          UPDATE docker_hosts 
          SET status = ${newStatus}, 
              consecutive_failures = ${newFailures}, 
              last_error = ${errorMsg.substring(0, 500)}
          WHERE id = ${host.id}
        `;

        results.push({ hostId: host.id, name: host.name, status: newStatus, error: errorMsg })
      }
    }))

    return new Response(JSON.stringify({
      polled: hosts.length,
      stale_marked: staleUpdate.length,
      stale_threshold_minutes: staleThresholdMinutes,
      results,
      timestamp: new Date().toISOString()
    }), { headers })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
  }
};

export const config: Config = {
  path: '/api/host-health-poll',
};
