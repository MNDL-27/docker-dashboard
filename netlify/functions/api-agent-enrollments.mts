import crypto from "crypto";
import { buildCorsHeaders } from './lib/security.mjs';
import type { Config } from "@netlify/functions";
import { sql } from "./lib/db.mjs";
import { requireAuth } from "./lib/auth.mjs";
import { assertOrganizationNodeCapacityAvailable, assertOrganizationWriteAllowed, enforceOrganizationNodeLimit } from "./lib/access-controls.mjs";
import { decryptSecret, encryptSecret } from "./lib/crypto.mjs";
import { ensureAgentEnrollmentSchema } from "./lib/ensure-agent-enrollment-schema.mjs";
import { buildValidatedAgentUrl, normalizeAndValidateHostUrl } from "./lib/host-url.mjs";
import {
  buildWatchtowerAgentAdvancedInstallCommand,
  buildWatchtowerAgentEnrollmentInstallCommand,
  buildWatchtowerAgentLocalVerifyCommand,
  buildWatchtowerAgentNextStepSummary,
  buildWatchtowerAgentReleaseResponse,
  buildWatchtowerAgentSetupSummary,
  buildWatchtowerAgentVerifySummary,
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  getWatchtowerAgentModeLabel,
  getWatchtowerAgentRecommendedBindAddress,
  type WatchtowerAgentConnectionMode,
} from "../../shared/watchtower-agent-release.ts";

type SessionStatus = "created" | "claimed" | "installed" | "expired" | "cancelled";
type ReasonCode =
  | "url_unreachable"
  | "agent_unauthorized"
  | "agent_not_installed"
  | "agent_outdated"
  | "cloudflare_access_missing"
  | "metrics_unavailable";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
}

function badRequest(error: string, code?: string, status = 400) {
  return json({ error, ...(code ? { code } : {}) }, { status });
}

function parseConnectionMode(value: unknown): WatchtowerAgentConnectionMode | null {
  return value === "agent" || value === "cloudflare_tunnel" ? value : null;
}

function hashEnrollmentToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createEnrollmentToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createAgentApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

function trimOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function requireOrgAdmin(organizationId: string, userId: string, isPlatformAdmin: boolean) {
  await assertOrganizationWriteAllowed({ organizationId, isPlatformAdmin });
  if (isPlatformAdmin) return true;

  const members = await sql`
    SELECT role FROM organization_members
    WHERE organization_id = ${organizationId} AND user_id = ${userId}
  `;

  if (members.length > 0 && ["owner", "admin"].includes(members[0].role)) {
    return true;
  }

  // Fallback: during onboarding the membership row may not have synced from Clerk yet.
  // If the user created the org, treat them as an admin.
  const org = await sql`
    SELECT created_by FROM organizations
    WHERE id = ${organizationId}
  `;

  return org.length > 0 && org[0].created_by === userId;
}

function buildAgentHeaders(options: {
  hostUrl: string;
  connectionMode: WatchtowerAgentConnectionMode;
  dockerSocketPath: string;
  agentApiKey: string | null;
  cfServiceTokenId: string | null;
  cfServiceTokenSecret: string | null;
  path: string;
}) {
  const reqHeaders: Record<string, string> = {};

  if (options.agentApiKey) {
    reqHeaders["X-Agent-Key"] = options.agentApiKey;
  }

  if (options.dockerSocketPath && options.dockerSocketPath !== "/var/run/docker.sock") {
    reqHeaders["X-Docker-Socket"] = options.dockerSocketPath;
  }

  if (options.connectionMode === "cloudflare_tunnel") {
    if (options.cfServiceTokenId) {
      reqHeaders["CF-Access-Client-Id"] = options.cfServiceTokenId;
    }
    if (options.cfServiceTokenSecret) {
      reqHeaders["CF-Access-Client-Secret"] = options.cfServiceTokenSecret;
    }
  }

  return { url: buildValidatedAgentUrl(options.hostUrl, options.path), headers: reqHeaders };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5000) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error: any) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new Error("Agent connection timed out");
    }
    throw new Error(error?.message || "Agent connection failed");
  }
}

function reasonFromFailure(options: {
  status?: number;
  connectionMode: WatchtowerAgentConnectionMode;
  message?: string;
  stage: "ping" | "agent_version" | "metrics";
}): ReasonCode {
  if (options.connectionMode === "cloudflare_tunnel" && options.status === 403) {
    return "cloudflare_access_missing";
  }
  if (options.status === 401) {
    return "agent_unauthorized";
  }
  if (options.status === 404 || options.status === 405) {
    return "agent_not_installed";
  }
  if (options.stage === "metrics") {
    return "metrics_unavailable";
  }
  return "url_unreachable";
}

function remediationForReason(
  reason: ReasonCode,
  agentApiKey: string,
  connectionMode: WatchtowerAgentConnectionMode,
) {
  switch (reason) {
    case "agent_outdated":
      return buildWatchtowerAgentAdvancedInstallCommand({ agentApiKey, connectionMode });
    case "metrics_unavailable":
      return buildWatchtowerAgentLocalVerifyCommand();
    case "agent_not_installed":
    case "agent_unauthorized":
    case "cloudflare_access_missing":
    case "url_unreachable":
    default:
      return buildWatchtowerAgentLocalVerifyCommand();
  }
}

async function pingEnrollmentHost(input: {
  hostId: string;
  hostUrl: string;
  connectionMode: WatchtowerAgentConnectionMode;
  dockerSocketPath: string;
  agentApiKey: string;
  cfServiceTokenId: string | null;
  cfServiceTokenSecret: string | null;
}) {
  const common = {
    hostUrl: input.hostUrl,
    connectionMode: input.connectionMode,
    dockerSocketPath: input.dockerSocketPath,
    agentApiKey: input.agentApiKey,
    cfServiceTokenId: input.cfServiceTokenId,
    cfServiceTokenSecret: input.cfServiceTokenSecret,
  };

  try {
    const pingReq = buildAgentHeaders({ ...common, path: "/docker/_ping" });
    const pingResp = await fetchWithTimeout(pingReq.url, { method: "GET", headers: pingReq.headers }, 5000);
    const pingText = await pingResp.text();

    if (!pingResp.ok) {
      return {
        ok: false,
        status: pingText,
        reason_code: reasonFromFailure({
          status: pingResp.status,
          connectionMode: input.connectionMode,
          message: pingText,
          stage: "ping",
        }),
      };
    }

    let dockerVersion: string | null = null;
    let osInfo: string | null = null;
    try {
      const versionReq = buildAgentHeaders({ ...common, path: "/docker/version" });
      const versionResp = await fetchWithTimeout(versionReq.url, { method: "GET", headers: versionReq.headers }, 5000);
      if (versionResp.ok) {
        const versionData = await versionResp.json();
        dockerVersion = versionData.Version || null;
        osInfo = versionData.Os ? `${versionData.Os}/${versionData.Arch}` : null;
      }
    } catch {
      // best effort
    }

    let agentVersion: string | null = null;
    let agentVersionError: string | null = null;
    try {
      const agentReq = buildAgentHeaders({ ...common, path: "/agent/version" });
      const agentResp = await fetchWithTimeout(agentReq.url, { method: "GET", headers: agentReq.headers }, 5000);
      if (agentResp.ok) {
        const agentData = await agentResp.json();
        agentVersion = agentData.agent_version || agentData.version || null;
      } else {
        agentVersionError = `GET /agent/version returned ${agentResp.status}`;
      }
    } catch (error: any) {
      agentVersionError = error?.message || "GET /agent/version failed";
    }

    let metricsReason: ReasonCode | null = null;
    let capabilityGap = false;
    try {
      const metricsReq = buildAgentHeaders({ ...common, path: "/metrics" });
      const metricsResp = await fetchWithTimeout(metricsReq.url, { method: "GET", headers: metricsReq.headers }, 5000);
      if (!metricsResp.ok) {
        metricsReason = reasonFromFailure({
          status: metricsResp.status,
          connectionMode: input.connectionMode,
          stage: "metrics",
        });
      } else {
        const metricsData = await metricsResp.json();
        capabilityGap = !metricsData || typeof metricsData !== "object" || metricsData.uptime_seconds == null || !Array.isArray(metricsData.disks);
      }
    } catch {
      metricsReason = "metrics_unavailable";
    }

    const releaseResponse = buildWatchtowerAgentReleaseResponse(agentVersion, capabilityGap);
    const reasonCode =
      releaseResponse.agent_update_status === "update_required"
        ? "agent_outdated"
        : metricsReason;

    await sql`
      UPDATE docker_hosts
      SET status = 'connected',
          last_seen_at = now(),
          docker_version = COALESCE(${dockerVersion}, docker_version),
          agent_version = COALESCE(${agentVersion}, agent_version),
          os_info = COALESCE(${osInfo}, os_info),
          last_error = ${reasonCode},
          consecutive_failures = 0
      WHERE id = ${input.hostId}
    `;

    return {
      ok: true,
      status: pingText,
      docker_version: dockerVersion,
      agent_version: agentVersion,
      agent_version_error: agentVersionError,
      os_info: osInfo,
      connection_mode: input.connectionMode,
      reason_code: reasonCode,
      ...releaseResponse,
    };
  } catch (error: any) {
    const reasonCode = reasonFromFailure({
      connectionMode: input.connectionMode,
      message: error?.message,
      stage: "ping",
    });

    await sql`
      UPDATE docker_hosts
      SET status = 'error',
          last_error = ${error?.message || reasonCode},
          consecutive_failures = COALESCE(consecutive_failures, 0) + 1
      WHERE id = ${input.hostId}
    `;

    return {
      ok: false,
      status: error?.message || "Connection failed",
      reason_code: reasonCode,
      docker_version: null,
      agent_version: null,
      agent_version_error: null,
      os_info: null,
      connection_mode: input.connectionMode,
      ...buildWatchtowerAgentReleaseResponse(null),
    };
  }
}


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildHeaders(req) });
  }

  await ensureAgentEnrollmentSchema();
  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    if (req.method === "POST" && pathname.endsWith("/exchange")) {
      const body = await req.json().catch(() => null);
      const enrollmentToken = typeof body?.enrollment_token === "string" ? body.enrollment_token.trim() : "";
      if (!enrollmentToken) {
        return badRequest("enrollment_token is required");
      }

      const tokenHash = hashEnrollmentToken(enrollmentToken);
      const rows = await sql`
        SELECT *
        FROM agent_enrollment_sessions
        WHERE enrollment_token_hash = ${tokenHash}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return badRequest("Enrollment token is invalid or expired", "invalid_enrollment_token", 404);
      }

      const session = rows[0];
      const now = new Date();
      const expired = new Date(session.expires_at) <= now;
      if (expired) {
        await sql`
          UPDATE agent_enrollment_sessions
          SET status = 'expired'
          WHERE id = ${session.id}
        `;
        return badRequest("Enrollment token has expired", "expired_enrollment_token", 410);
      }

      if (session.status !== "created") {
        return badRequest("Enrollment token has already been used", "claimed_enrollment_token", 409);
      }

      await sql`
        UPDATE agent_enrollment_sessions
        SET status = 'claimed',
            claimed_at = now()
        WHERE id = ${session.id}
      `;

      return json({
        session_id: session.id,
        agent_api_key: decryptSecret(session.encrypted_agent_api_key, session.id, "agent_api_key"),
        expected_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
        bind_address: getWatchtowerAgentRecommendedBindAddress(session.connection_mode),
        port: "9876",
        docker_socket_path: session.docker_socket_path,
        connection_mode: session.connection_mode,
      });
    }

    const auth = await requireAuth(req);
    if (!auth.orgId) {
      return badRequest("Active org required");
    }

    const isAdmin = await requireOrgAdmin(auth.orgId, auth.userId, auth.isPlatformAdmin);
    if (!isAdmin) {
      return badRequest("Admin access required for active org", undefined, 403);
    }

    if (req.method === "POST" && pathname.endsWith("/finalize")) {
      const body = await req.json().catch(() => null);
      const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";
      if (!sessionId) {
        return badRequest("session_id is required");
      }

      const rows = await sql`
        SELECT *
        FROM agent_enrollment_sessions
        WHERE id = ${sessionId} AND organization_id = ${auth.orgId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        return badRequest("Enrollment session not found", "missing_enrollment_session", 404);
      }

      const session = rows[0];
      if (session.status === "cancelled") {
        return badRequest("Enrollment session is cancelled", "cancelled_enrollment_session", 409);
      }

      if (new Date(session.expires_at) <= new Date() && session.status !== "installed") {
        await sql`
          UPDATE agent_enrollment_sessions
          SET status = 'expired'
          WHERE id = ${session.id}
        `;
        return badRequest("Enrollment session has expired", "expired_enrollment_session", 410);
      }

      const agentApiKey = decryptSecret(session.encrypted_agent_api_key, session.id, "agent_api_key");
      const cfServiceTokenId = decryptSecret(session.encrypted_cf_service_token_id, session.id, "cf_service_token_id");
      const cfServiceTokenSecret = decryptSecret(session.encrypted_cf_service_token_secret, session.id, "cf_service_token_secret");
      if (!agentApiKey) {
        return badRequest("Enrollment session is missing an agent API key", "invalid_enrollment_session", 500);
      }

      // Update host_url if provided in finalize body
      let finalHostUrl = session.host_url;
      const providedHostUrl = typeof body?.host_url === "string" ? body.host_url.trim() : "";
      if (providedHostUrl) {
        try {
          finalHostUrl = normalizeAndValidateHostUrl(providedHostUrl);
          await sql`
            UPDATE agent_enrollment_sessions
            SET host_url = ${finalHostUrl}
            WHERE id = ${session.id}
          `;
        } catch (error: any) {
          return badRequest(error?.message || "Provided host_url is invalid");
        }
      }

      let hostId = session.docker_host_id as string | null;
      let host;

      if (hostId) {
        const existing = await sql`
          SELECT * FROM docker_hosts
          WHERE id = ${hostId} AND organization_id = ${auth.orgId}
          LIMIT 1
        `;
        host = existing[0] || null;
      }

      if (!host) {
        await assertOrganizationNodeCapacityAvailable({
          organizationId: auth.orgId,
          isPlatformAdmin: auth.isPlatformAdmin,
        });

        const inserted = await sql`
          INSERT INTO docker_hosts (organization_id, name, host_url, connection_mode, docker_socket_path, created_by, status)
          VALUES (${auth.orgId}, ${session.host_name}, ${finalHostUrl}, ${session.connection_mode}, ${session.docker_socket_path || "/var/run/docker.sock"}, ${auth.userId}, 'unknown')
          RETURNING *
        `;
        host = inserted[0];
        hostId = host.id;

        await sql`
          INSERT INTO docker_host_secrets (host_id, agent_api_key, cf_service_token_id, cf_service_token_secret)
          VALUES (
            ${host.id},
            ${encryptSecret(agentApiKey, host.id, "agent_api_key")},
            ${cfServiceTokenId ? encryptSecret(cfServiceTokenId, host.id, "cf_service_token_id") : null},
            ${cfServiceTokenSecret ? encryptSecret(cfServiceTokenSecret, host.id, "cf_service_token_secret") : null}
          )
          ON CONFLICT (host_id)
          DO UPDATE SET
            agent_api_key = EXCLUDED.agent_api_key,
            cf_service_token_id = EXCLUDED.cf_service_token_id,
            cf_service_token_secret = EXCLUDED.cf_service_token_secret
        `;

        await sql`
          UPDATE organizations
          SET onboarding_status = 'completed',
              onboarding_completed_at = COALESCE(onboarding_completed_at, now())
          WHERE id = ${auth.orgId}
        `;
      } else if (providedHostUrl) {
        // If host already exists, update its URL too
        await sql`
          UPDATE docker_hosts
          SET host_url = ${finalHostUrl}
          WHERE id = ${host.id}
        `;
      }

      const limitState = await enforceOrganizationNodeLimit({
        organizationId: auth.orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      if (!limitState.allowedHostIds.includes(hostId!)) {
        return badRequest(
          "This host is over your current plan limit. Remove extra hosts or upgrade to reactivate it.",
          "host_plan_limit_exceeded",
          402,
        );
      }

      const pingResult = await pingEnrollmentHost({
        hostId: hostId!,
        hostUrl: finalHostUrl,
        connectionMode: session.connection_mode,
        dockerSocketPath: session.docker_socket_path || "/var/run/docker.sock",
        agentApiKey,
        cfServiceTokenId,
        cfServiceTokenSecret,
      });

      const remediationCommand = pingResult.reason_code
        ? remediationForReason(pingResult.reason_code, agentApiKey, session.connection_mode)
        : null;

      await sql`
        UPDATE agent_enrollment_sessions
        SET docker_host_id = ${hostId},
            status = ${pingResult.ok ? "installed" : session.status === "installed" ? "installed" : "claimed"},
            installed_at = CASE WHEN ${pingResult.ok} THEN now() ELSE installed_at END
        WHERE id = ${session.id}
      `;

      return json({
        host,
        ...pingResult,
        remediation_command: remediationCommand,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      await assertOrganizationNodeCapacityAvailable({
        organizationId: auth.orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      const connectionMode = parseConnectionMode(body?.connection_mode);
      if (!connectionMode) {
        return badRequest("connection_mode must be 'agent' or 'cloudflare_tunnel'");
      }

      const hostName = trimOrDefault(body?.host_name, "");
      const hostUrl = trimOrDefault(body?.host_url, "");
      const dockerSocketPath = trimOrDefault(body?.docker_socket_path, "/var/run/docker.sock");
      const cfServiceTokenId = trimOrDefault(body?.cf_service_token_id, "");
      const cfServiceTokenSecret = trimOrDefault(body?.cf_service_token_secret, "");

      if (!hostName) {
        return badRequest("host_name is required");
      }

      let normalizedHostUrl: string;
      if (hostUrl) {
        try {
          normalizedHostUrl = normalizeAndValidateHostUrl(hostUrl);
        } catch (error: any) {
          return badRequest(error?.message || "host_url is invalid");
        }
      } else {
        // Use a placeholder if no URL is provided yet
        normalizedHostUrl = "http://pending-setup.internal";
      }

      const token = createEnrollmentToken();
      const sessionApiKey = createAgentApiKey();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const rows = await sql`
        INSERT INTO agent_enrollment_sessions (
          organization_id,
          created_by_user_id,
          host_name,
          host_url,
          connection_mode,
          docker_socket_path,
          encrypted_agent_api_key,
          encrypted_cf_service_token_id,
          encrypted_cf_service_token_secret,
          enrollment_token_hash,
          status,
          expires_at
        )
        VALUES (
          ${auth.orgId},
          ${auth.userId},
          ${hostName},
          ${normalizedHostUrl},
          ${connectionMode},
          ${dockerSocketPath},
          ${encryptSecret(sessionApiKey, "pending", "agent_api_key")},
          ${cfServiceTokenId ? encryptSecret(cfServiceTokenId, "pending", "cf_service_token_id") : null},
          ${cfServiceTokenSecret ? encryptSecret(cfServiceTokenSecret, "pending", "cf_service_token_secret") : null},
          ${hashEnrollmentToken(token)},
          'created',
          ${expiresAt.toISOString()}
        )
        RETURNING *
      `;

      const session = rows[0];

      await sql`
        UPDATE agent_enrollment_sessions
        SET encrypted_agent_api_key = ${encryptSecret(sessionApiKey, session.id, "agent_api_key")},
            encrypted_cf_service_token_id = ${cfServiceTokenId ? encryptSecret(cfServiceTokenId, session.id, "cf_service_token_id") : null},
            encrypted_cf_service_token_secret = ${cfServiceTokenSecret ? encryptSecret(cfServiceTokenSecret, session.id, "cf_service_token_secret") : null}
        WHERE id = ${session.id}
      `;

      const enrollUrl = `${url.origin}/api/agent-enrollments/exchange`;
      return json({
        session_id: session.id,
        enrollment_token: token,
        expires_at: expiresAt.toISOString(),
        install_command: buildWatchtowerAgentEnrollmentInstallCommand({
          enrollmentToken: token,
          enrollUrl,
          connectionMode,
          dockerSocketPath,
        }),
        verify_command: buildWatchtowerAgentLocalVerifyCommand(),
        setup_summary: buildWatchtowerAgentSetupSummary(connectionMode),
        verify_summary: buildWatchtowerAgentVerifySummary(connectionMode),
        next_step_summary: buildWatchtowerAgentNextStepSummary(connectionMode),
        mode_label: getWatchtowerAgentModeLabel(connectionMode),
        advanced_manual_command: buildWatchtowerAgentAdvancedInstallCommand({
          agentApiKey: sessionApiKey,
          connectionMode,
          dockerSocketPath,
        }),
      });
    }

    return badRequest("Method not allowed", undefined, 405);
  } catch (error: any) {
    return badRequest(error?.message || "Request failed", error?.code, 500);
  }
};

export const config: Config = {
  path: "/api/agent-enrollments*",
};
