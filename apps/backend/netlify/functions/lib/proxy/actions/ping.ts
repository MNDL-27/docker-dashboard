import { sql } from '../../db.mjs';
import { buildRequest, buildAgentRequest, dockerFetch } from '../client';
import { resolveOrganizationEntitlements } from '../../access-controls.mjs';
import { buildWatchtowerAgentReleaseResponse } from '../../agent-release.mts';
import { fetchAgentVersionReport } from '../metrics';
import {
  isAgentApiKeyFailure,
  isAgentDockerSocketFailure,
  summarizeAgentConnectionFailure,
} from '../errors';
import { formatDiagnosticDetail, parseDiagnosticPayload } from '../../../../../../../shared/lib/diagnostics';
import type { ProxyContext } from '../types';

export async function handlePing(ctx: ProxyContext) {
  const { host, secrets, corsHeaders, createProblemResponse } = ctx;

  const reqData = buildRequest(host, secrets, '/_ping', 'GET');
  const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers, 3000);

  const text = await dockerResponse.text();
  const statusText = formatDiagnosticDetail(parseDiagnosticPayload(text)) ?? text.replace(/\s+/g, ' ').trim().slice(0, 160);
  const ok = dockerResponse.ok;

  if (!ok) {
    const upstreamStatus = dockerResponse.status || 502;
    const agentApiKeyFailure = isAgentApiKeyFailure(upstreamStatus, text);
    const parsedDetails = parseDiagnosticPayload(text);
    const dockerSocketFailure = isAgentDockerSocketFailure(parsedDetails);
    await sql`
      UPDATE docker_hosts
      SET status = 'error'
      WHERE id = ${host.id}
    `;

    const detail = summarizeAgentConnectionFailure(upstreamStatus, text, host.connection_mode);

    if (agentApiKeyFailure) {
      return new Response(
        JSON.stringify({
          type: 'agent_unauthorized',
          title: 'Agent authentication failed',
          status: 502,
          detail,
          code: 'agent_auth_failed',
          upstream_status: upstreamStatus,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/problem+json',
          },
        },
      );
    }

    if (dockerSocketFailure) {
      const agentVersionReport = await fetchAgentVersionReport(host, secrets);
      if (agentVersionReport.agentVersion) {
        const entitlements = await resolveOrganizationEntitlements({
          organizationId: host.organization_id,
          isPlatformAdmin: ctx.auth.isPlatformAdmin,
        });
        
        if (!entitlements.canMonitorWithoutDocker) {
          return createProblemResponse(
            403,
            'Docker not installed',
            'This host does not have Docker installed. Upgrade your plan to monitor non-Docker hosts.',
            'docker_missing_upgrade_required',
          );
        }
      } else {
        return createProblemResponse(
          502,
          'Docker socket unavailable',
          detail,
          'docker_socket_unavailable',
        );
      }
    } else {
      return createProblemResponse(
        upstreamStatus,
        'Connection test failed',
        detail,
        'agent_connection_failed',
      );
    }
  }

  let dockerVersion = null;
  let agentVersion = null;
  let agentVersionError = null;
  let osInfo = null;
  try {
    const vReq = buildRequest(host, secrets, '/version', 'GET');
    const vResp = await dockerFetch(vReq.url, vReq.method, vReq.headers, 5000);
    if (vResp.ok) {
      const vData = await vResp.json();
      dockerVersion = vData.Version || null;
      osInfo = vData.Os ? `${vData.Os}/${vData.Arch}` : null;
    }
  } catch (_) { /* version endpoint optional */ }

  const agentVersionReport = await fetchAgentVersionReport(host, secrets);
  agentVersion = agentVersionReport.agentVersion;
  agentVersionError = agentVersionReport.agentVersionError;
  if (agentVersionError) {
    console.warn('[docker-proxy] agent version lookup failed', {
      hostId: host.id,
      hostUrl: host.host_url,
      error: agentVersionError,
    });
  }

  const releaseResponse = buildWatchtowerAgentReleaseResponse(agentVersion);
  const agentNeedsUpdate = releaseResponse.agent_update_status === 'update_required';

  await sql`
    UPDATE docker_hosts 
    SET status = 'connected', 
        last_seen_at = now(),
        docker_version = COALESCE(${dockerVersion}, docker_version),
        agent_version = COALESCE(${agentVersion}, agent_version),
        os_info = COALESCE(${osInfo}, os_info)
    WHERE id = ${host.id}
  `;

  return new Response(JSON.stringify({
    ok,
    status: statusText,
    docker_version: dockerVersion,
    agent_version: agentVersion,
    os_info: osInfo,
    connection_mode: host.connection_mode,
    agent_version_error: agentVersionError,
    ...releaseResponse,
    agent_update_available: agentNeedsUpdate,
  }), { headers: corsHeaders });
}
