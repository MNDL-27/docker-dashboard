import { buildRequest, dockerFetch } from '../client';
import { sanitizeContainerId } from '../utils';
import { parseDiagnosticPayload, formatDiagnosticDetail } from '../../../../../../../shared/lib/diagnostics';
import { classifyDockerProxyFailure } from '../errors';
import { recordProxyAudit } from '../audit';
import { invalidateContainerCache } from '../container-cache';
import type { ProxyContext } from '../types';

export async function handleContainerMutation(
  ctx: ProxyContext,
  containerId: string,
  action: 'container-start' | 'container-stop' | 'container-restart',
  idempotencyKey: string | null,
) {
  const { host, secrets, auth, corsHeaders, createProblemResponse } = ctx;

  if (!idempotencyKey) {
    return createProblemResponse(400, "Missing Idempotency Key", "Mutations require an Idempotency-Key header for safety.");
  }

  const sanitizedId = sanitizeContainerId(containerId);
  const dockerPath = `/containers/${sanitizedId}/${action.replace('container-', '')}`;
  const reqData = buildRequest(host, secrets, dockerPath, 'POST');
  const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers, 8000);

  const text = await dockerResponse.text();
  const ok = dockerResponse.status === 204 || dockerResponse.status === 304 || dockerResponse.ok;
  if (!ok) {
    const failure = classifyDockerProxyFailure(dockerResponse.status || 502, parseDiagnosticPayload(text));
    return new Response(JSON.stringify(failure), { status: dockerResponse.status || 502, headers: corsHeaders });
  }

  await recordProxyAudit({
    organizationId: host.organization_id,
    actorUserId: auth.userId,
    action,
    hostId: host.id,
    containerId: sanitizedId,
    requestMetadata: { idempotencyKey },
  });

  // Invalidate container list cache since container state changed
  await invalidateContainerCache(host.id);

  return new Response(JSON.stringify({ ok, status: dockerResponse.status, message: formatDiagnosticDetail(parseDiagnosticPayload(text)) ?? "" }), { headers: corsHeaders });
}
