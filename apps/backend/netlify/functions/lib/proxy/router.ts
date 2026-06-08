import { sql } from '../db.mjs';
import { requireAuth } from '../auth.mjs';
import { assertHostProxyAllowed, assertOrganizationWriteAllowed, enforceOrganizationNodeLimit } from '../access-controls.mjs';
import { decryptHostSecrets } from '../crypto.mjs';
import { ensureDockerHostSchema } from '../ensure-docker-host-schema.mjs';
import { ProxyRequestParamsSchema } from '../../../../../../shared/schema/proxy.ts';
import { buildCorsHeaders, applyRateLimit, RATE_LIMITS } from '../security.mjs';
import { createProblemResponse as createBaseProblemResponse } from '../../../../../../shared/schema/error.ts';
import { classifyTopLevelProxyError } from './errors';
import { buildRequest, dockerFetch } from './client';
import type { ProxyContext, AuthContext } from './types';
import { handleAllContainers, handleAllContainerStats } from './actions/org-wide';
import { getCachedContainersForOrg } from './container-cache';
import { handleHostMetrics } from './actions/host-metrics';
import { handlePing } from './actions/ping';
import { handleContainerLogs } from './actions/logs';
import { handleContainerMutation } from './actions/mutations';
import { handleFsList, handleFsRead } from './actions/filesystem';
import { resolveSimpleAction } from './actions/simple';
import { sanitizeContainerId } from './utils';

export async function routeProxyRequest(req: Request): Promise<Response> {
  const rateLimitResponse = await applyRateLimit(req, 'proxy', RATE_LIMITS.PROXY);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const corsHeaders = buildCorsHeaders(req);
  const createProblemResponse = (
    status: number,
    title: string,
    detail?: string,
    type?: string,
  ) => createBaseProblemResponse(status, title, detail, type, corsHeaders);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await ensureDockerHostSchema();

    const auth = await requireAuth(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return createProblemResponse(400, "Invalid JSON payload");
    }

    const parseResult = ProxyRequestParamsSchema.safeParse(body);
    if (!parseResult.success) {
      return createProblemResponse(400, "Validation Error", JSON.stringify(parseResult.error.format()));
    }
    const { action, hostId, containerId, params } = parseResult.data;

    const authCtx: AuthContext = {
      userId: auth.userId,
      orgId: auth.orgId,
      isPlatformAdmin: auth.isPlatformAdmin,
    };

    // ── Org-wide actions ──
    if (action === 'all-containers') {
      return getCachedContainersForOrg(authCtx, corsHeaders, createProblemResponse);
    }

    if (action === 'all-container-stats') {
      return handleAllContainerStats(authCtx, corsHeaders, createProblemResponse);
    }

    // ── Host-specific actions ──
    if (!hostId) return createProblemResponse(400, "hostId required");

    const hostRecords = await sql`
      SELECT h.* FROM docker_hosts h
      JOIN organization_members om ON h.organization_id = om.organization_id
      WHERE h.id = ${hostId} AND om.user_id = ${auth.userId}
    `;

    if (hostRecords.length === 0) {
      return createProblemResponse(404, "Host not found or access denied");
    }
    const host = hostRecords[0];

    const limitState = await enforceOrganizationNodeLimit({
      organizationId: host.organization_id,
      isPlatformAdmin: auth.isPlatformAdmin,
    });

    if (!limitState.allowedHostIds.includes(host.id)) {
      return createProblemResponse(
        402,
        "Host over plan limit",
        "This host is inactive because your current plan limit has been exceeded. Remove extra hosts or upgrade to reactivate it.",
        "host_plan_limit_exceeded",
      );
    }

    await assertHostProxyAllowed({ hostId, isPlatformAdmin: auth.isPlatformAdmin });

    const secretsRecord = await sql`
      SELECT agent_api_key, cf_service_token_id, cf_service_token_secret 
      FROM docker_host_secrets WHERE host_id = ${hostId}
    `;
    const secrets = decryptHostSecrets(secretsRecord[0] || null, host.id);

    const ctx: ProxyContext = {
      host,
      secrets,
      auth: authCtx,
      corsHeaders,
      createProblemResponse,
    };

    // ── Host metrics (special handling) ──
    if (action === 'host-metrics') {
      return handleHostMetrics(ctx);
    }

    // ── Ping (complex handling) ──
    if (action === 'ping') {
      return handlePing(ctx);
    }

    // ── Container logs (special handling) ──
    if (action === 'container-logs') {
      if (!containerId) return createProblemResponse(400, "containerId required");
      return handleContainerLogs(ctx, containerId, params as Record<string, unknown>);
    }

    // ── Container mutations ──
    if (['container-start', 'container-stop', 'container-restart'].includes(action)) {
      if (!containerId) return createProblemResponse(400, "containerId required");
      const idempotencyKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');
      await assertOrganizationWriteAllowed({
        organizationId: host.organization_id,
        isPlatformAdmin: auth.isPlatformAdmin,
      });
      return handleContainerMutation(ctx, containerId, action as 'container-start' | 'container-stop' | 'container-restart', idempotencyKey);
    }

    // ── File system actions ──
    if (action === 'container-fs-list') {
      if (!containerId) return createProblemResponse(400, "containerId required");
      return handleFsList(ctx, containerId, params as Record<string, unknown>);
    }

    if (action === 'container-fs-read') {
      if (!containerId) return createProblemResponse(400, "containerId required");
      return handleFsRead(ctx, containerId, params as Record<string, unknown>);
    }

    // ── Simple proxy actions ──
    const simpleAction = resolveSimpleAction(action, containerId, createProblemResponse);
    if (simpleAction instanceof Response) {
      return simpleAction;
    }

    const reqData = buildRequest(host, secrets, simpleAction.dockerPath, simpleAction.method ?? 'GET');
    const dockerResponse = await dockerFetch(reqData.url, reqData.method, reqData.headers, simpleAction.timeoutMs ?? 5000);

    if (!dockerResponse.ok) {
      const { parseDiagnosticPayload } = await import('../../../../../../shared/lib/diagnostics');
      const { classifyDockerProxyFailure } = await import('./errors');
      const rawDetails = await dockerResponse.text();
      const failure = classifyDockerProxyFailure(dockerResponse.status || 502, parseDiagnosticPayload(rawDetails));
      return new Response(JSON.stringify(failure), { status: dockerResponse.status || 502, headers: corsHeaders });
    }

    const payload = await dockerResponse.json();
    const responseHeaders = { ...corsHeaders };

    if (req.method === 'GET') {
      responseHeaders['Cache-Control'] = 'private, max-age=0, must-revalidate';
    }
    return new Response(JSON.stringify(payload), { headers: responseHeaders });

  } catch (error: unknown) {
    const { SecretCryptoError } = await import('../crypto.mjs');
    if (error instanceof SecretCryptoError) {
      return createProblemResponse(500, 'Secret storage failed', error.message);
    }
    const classified = classifyTopLevelProxyError(error);
    return createProblemResponse(classified.status, classified.title, classified.detail, classified.type);
  }
}
