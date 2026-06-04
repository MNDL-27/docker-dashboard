import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import crypto from 'node:crypto';
import { sql } from './lib/db.mjs';
import { decryptHostSecrets, SecretCryptoError } from './lib/crypto.mjs';
import {
  DEFAULT_UNHEALTHY_THRESHOLD,
  parseStaleThresholdMinutes,
  staleCutoffDate,
  failureStatusForCount,
} from './lib/host-health.mjs';
import { enforceOrganizationNodeLimit } from './lib/access-controls.mjs';
import { buildWatchtowerAgentReleaseResponse } from './lib/agent-release.mts';
import { ensureDockerHostSchema } from './lib/ensure-docker-host-schema.mjs';
import { buildValidatedAgentUrl } from './lib/host-url.mjs';


const buildHeaders = (req: Request) => buildCorsHeaders(req);
const PING_TIMEOUT_MS = 10000

function isAuthorizedSchedulerRequest(req: Request) {
  const expectedSecret = (process.env.HEALTH_POLL_SECRET || '').trim()
  if (!expectedSecret) {
    return false
  }
  const providedSecret = (req.headers.get('x-cron-secret') || '').trim()
  const expectedBuf = Buffer.from(expectedSecret)
  const providedBuf = Buffer.from(providedSecret)
  if (expectedBuf.length !== providedBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}

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
    pingUrl: buildValidatedAgentUrl(base, '/docker/_ping'),
    dockerVersionUrl: buildValidatedAgentUrl(base, '/docker/version'),
    agentVersionUrl: buildValidatedAgentUrl(base, '/agent/version'),
    headers: reqHeaders
  }
}

function trimDiagnostic(value: string, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

async function fetchAgentVersionReport(
  host: { id: string; host_url: string; connection_mode: string; docker_socket_path: string | null },
  secrets: { agent_api_key?: string; cf_service_token_id?: string; cf_service_token_secret?: string } | null,
) {
  const { agentVersionUrl, headers: reqHeaders } = buildPingRequest(host, secrets)

  try {
    const agentResp = await fetch(agentVersionUrl, { headers: reqHeaders, signal: AbortSignal.timeout(5000) })
    if (!agentResp.ok) {
      const body = trimDiagnostic((await agentResp.text()).replace(/\s+/g, ' ').trim())
      return {
        agentVersion: null as string | null,
        agentVersionError: trimDiagnostic(
          body
            ? `GET /agent/version returned ${agentResp.status}: ${body}`
            : `GET /agent/version returned ${agentResp.status}`,
        ),
      }
    }

    const agentData = await agentResp.json()
    const agentVersion = agentData.agent_version || agentData.version || null
    if (!agentVersion) {
      return {
        agentVersion: null as string | null,
        agentVersionError: 'GET /agent/version did not include an agent version',
      }
    }

    return { agentVersion, agentVersionError: null as string | null }
  } catch (err: any) {
    return {
      agentVersion: null as string | null,
      agentVersionError: trimDiagnostic(`GET /agent/version failed: ${err?.message || 'Unknown error'}`),
    }
  }
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    await ensureDockerHostSchema();

    if (!isAuthorizedSchedulerRequest(req)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: buildHeaders(req) })
    }

    const orgRows = await sql<Array<{ organization_id: string | null }>>`
      SELECT DISTINCT organization_id
      FROM docker_hosts
      WHERE organization_id IS NOT NULL
    `;

    const allowedHostIds: string[] = [];
    for (const row of orgRows) {
      if (!row.organization_id) continue;
      const limitState = await enforceOrganizationNodeLimit({
        organizationId: row.organization_id,
        isPlatformAdmin: false,
      });
      allowedHostIds.push(...limitState.allowedHostIds);
    }

    if (allowedHostIds.length === 0) {
      return new Response(JSON.stringify({ polled: 0, message: 'No eligible hosts to poll' }), { headers: buildHeaders(req) });
    }

    const hosts = await sql`
      SELECT *
      FROM docker_hosts
      WHERE id = ANY(${allowedHostIds})
    `;

    const staleThresholdMinutes = parseStaleThresholdMinutes(process.env.HOST_STALE_THRESHOLD_MINUTES)
    const staleCutoff = staleCutoffDate(new Date(), staleThresholdMinutes)

    const staleUpdate = await sql`
      UPDATE docker_hosts
      SET status = 'stale'
      WHERE status = 'connected'
        AND id = ANY(${allowedHostIds})
        AND last_seen_at IS NOT NULL
        AND last_seen_at < ${staleCutoff.toISOString()}
      RETURNING id
    `

    if (hosts.length === 0) {
      return new Response(JSON.stringify({ polled: 0, message: 'No hosts to poll' }), { headers: buildHeaders(req) })
    }

    const results: any[] = []

    await Promise.allSettled(hosts.map(async (host) => {
      try {
        const secretsRecord = await sql`
          SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
          FROM docker_host_secrets WHERE host_id = ${host.id}
        `;
        const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

        const { pingUrl, dockerVersionUrl, headers: reqHeaders } = buildPingRequest(host as any, secrets)

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
        let agentVersionError: string | null = null
        let osInfo: string | null = null
        try {
          const vResp = await fetch(dockerVersionUrl, { headers: reqHeaders, signal: AbortSignal.timeout(5000) })
          if (vResp.ok) {
            const vData = await vResp.json()
            dockerVersion = vData.Version || null
            osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null
          }
        } catch (_) {}

        const agentVersionReport = await fetchAgentVersionReport(host as any, secrets)
        agentVersion = agentVersionReport.agentVersion
        agentVersionError = agentVersionReport.agentVersionError
        if (agentVersionError) {
          console.warn('[host-health-poll] agent version lookup failed', {
            hostId: host.id,
            hostUrl: host.host_url,
            error: agentVersionError,
          })
        }

        const releaseResponse = buildWatchtowerAgentReleaseResponse(agentVersion)
        const agentNeedsUpdate = releaseResponse.agent_update_status === 'update_required'

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
          agent_version_error: agentVersionError,
          ...releaseResponse,
          agent_update_available: agentNeedsUpdate,
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

        results.push({
          hostId: host.id,
          name: host.name,
          status: newStatus,
          error: errorMsg,
          ...(err instanceof SecretCryptoError ? { code: err.code } : {}),
        })
      }
    }))

    return new Response(JSON.stringify({
      polled: hosts.length,
      stale_marked: staleUpdate.length,
      stale_threshold_minutes: staleThresholdMinutes,
      results,
      timestamp: new Date().toISOString()
    }), { headers: buildHeaders(req) })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: buildHeaders(req) })
  }
};

export const config: Config = {
  path: '/api/host-health-poll',
};
