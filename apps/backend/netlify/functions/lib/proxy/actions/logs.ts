import { resolveOrganizationEntitlements } from '../../access-controls.mjs';
import { buildRequest, dockerFetch } from '../client';
import { sanitizeContainerId } from '../utils';
import { parseDiagnosticPayload } from '../../../../../../../shared/lib/diagnostics';
import { classifyDockerProxyFailure } from '../errors';
import { recordProxyAudit } from '../audit';
import type { ProxyContext } from '../types';

export async function handleContainerLogs(
  ctx: ProxyContext,
  containerId: string,
  params: Record<string, any>,
) {
  const { host, secrets, auth, corsHeaders, createProblemResponse } = ctx;

  const entitlements = await resolveOrganizationEntitlements({
    organizationId: host.organization_id,
    isPlatformAdmin: auth.isPlatformAdmin,
  });
  if (!entitlements.canUseLogs) {
    return createProblemResponse(
      403,
      "Logs require a paid subscription",
      "Container logs require an Individual, Business, or Dedicated subscription.",
      "feature_not_allowed",
    );
  }

  const requestedTail = Number(params?.tail) || 100;
  const tail = Math.min(Math.max(1, requestedTail), entitlements.logTailLines);
  const since = params?.since ? `&since=${params.since}` : '';
  const until = params?.until ? `&until=${params.until}` : '';
  const dockerPath = `/containers/${sanitizeContainerId(containerId)}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true${since}${until}`;

  const reqData = buildRequest(host, secrets, dockerPath, 'GET');
  const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers, 6000, entitlements.maxPayloadBytes);

  if (dockerResponse.status === 413) {
    return createProblemResponse(413, "Logs too large", "Payload exceeded your plan's log size limit. Upgrade for higher limits.");
  }
  if (!dockerResponse.ok) {
    const rawDetails = await dockerResponse.text();
    const failure = classifyDockerProxyFailure(dockerResponse.status || 502, parseDiagnosticPayload(rawDetails));
    return new Response(JSON.stringify(failure), { status: dockerResponse.status || 502, headers: corsHeaders });
  }

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

  await recordProxyAudit({
    organizationId: host.organization_id,
    actorUserId: auth.userId,
    action: 'container-logs',
    hostId: host.id,
    containerId: sanitizeContainerId(containerId),
    requestMetadata: { tail, since: params?.since, until: params?.until },
  });

  return new Response(JSON.stringify({ logs: lines }), { headers: corsHeaders });
}
