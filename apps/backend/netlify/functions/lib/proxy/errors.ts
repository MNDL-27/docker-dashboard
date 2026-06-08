import { parseDiagnosticPayload } from '../../../../../../shared/lib/diagnostics';

export function trimDiagnostic(value: string, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

export function extractDiagnosticMessage(details: unknown): string | null {
  if (!details) {
    return null;
  }

  if (typeof details === 'string') {
    const normalized = details.trim();
    return normalized ? trimDiagnostic(normalized) : null;
  }

  if (typeof details === 'object') {
    const detailRecord = details as Record<string, unknown>;
    const candidates = [
      detailRecord.detail,
      detailRecord.error,
      detailRecord.title,
      detailRecord.message,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return trimDiagnostic(candidate.trim());
      }
    }

    try {
      return trimDiagnostic(JSON.stringify(details));
    } catch {
      return null;
    }
  }

  return trimDiagnostic(String(details));
}

export function getDiagnosticField(details: unknown, field: string) {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const value = (details as Record<string, unknown>)[field];
  return typeof value === 'string' ? value.trim() : null;
}

export function stringifyDiagnostic(details: unknown) {
  if (typeof details === 'string') {
    return details;
  }

  if (details && typeof details === 'object') {
    try {
      return JSON.stringify(details);
    } catch {
      return '';
    }
  }

  return details === null || details === undefined ? '' : String(details);
}

export function isAgentDockerSocketFailure(details: unknown) {
  const error = getDiagnosticField(details, 'error') ?? '';
  const code = getDiagnosticField(details, 'code') ?? '';
  const diagnostic = extractDiagnosticMessage(details) ?? '';
  const haystack = `${code} ${error} ${diagnostic} ${stringifyDiagnostic(details)}`;

  return /docker_socket_unavailable/i.test(haystack) ||
    /docker socket not found/i.test(haystack) ||
    /docker api request failed/i.test(haystack);
}

export function summarizeDockerSocketFailure(details: unknown) {
  const diagnostic = extractDiagnosticMessage(details);

  if (diagnostic && /docker socket not found/i.test(diagnostic)) {
    return `${diagnostic}. Confirm Docker is running and that the saved Docker socket path matches the host.`;
  }

  return diagnostic
    ? `The Watchtower agent is reachable, but it could not talk to Docker through its configured socket (${diagnostic}). Re-run Troubleshoot / Repair so the systemd service gets Docker socket group access.`
    : 'The Watchtower agent is reachable, but it could not talk to Docker through its configured socket. Re-run Troubleshoot / Repair so the systemd service gets Docker socket group access.';
}

export function isAgentApiKeyFailure(status: number, rawDetails: string) {
  const diagnostic = extractDiagnosticMessage(parseDiagnosticPayload(rawDetails)) ?? '';
  const lower = diagnostic.toLowerCase();

  return lower.includes('invalid api key') ||
    lower.includes('invalid agent api key') ||
    (lower.includes('api key') && lower.includes('invalid'));
}

export function summarizeAgentConnectionFailure(
  status: number,
  rawDetails: string,
  connectionMode: string,
) {
  const parsedDetails = parseDiagnosticPayload(rawDetails);
  const diagnostic = extractDiagnosticMessage(parsedDetails);
  const isCloudflareHtml =
    typeof diagnostic === 'string' && /Cloudflare HTML error page:/i.test(diagnostic);

  if (isAgentApiKeyFailure(status, rawDetails)) {
    return 'The Watchtower agent is reachable, but it rejected the saved API key. Re-enter the API key from /etc/watchtower-agent/watchtower-agent.env or run the agent repair command so Dockerdash and the agent use the same key.';
  }

  if (isAgentDockerSocketFailure(parsedDetails)) {
    return summarizeDockerSocketFailure(parsedDetails);
  }

  if (status === 504) {
    return 'The Watchtower agent did not respond in time. Verify the agent service is running and reachable from Dockerdash.';
  }

  if ((status === 502 || status === 530) && isCloudflareHtml) {
    if (connectionMode === 'cloudflare_tunnel') {
      return 'Cloudflare Tunnel could not reach your Watchtower agent. Verify the tunnel is running, the route points to the agent, and any CF Access service token is correct.';
    }

    return 'A Cloudflare gateway in front of your Watchtower agent returned an error. Verify the saved host URL, reverse proxy, and agent service.';
  }

  if (isCloudflareHtml) {
    if (connectionMode === 'cloudflare_tunnel') {
      return `Cloudflare returned HTTP ${status}. The tunnel may be misconfigured or the agent service is unreachable. Check the tunnel health and agent process.`;
    }
    return `Cloudflare returned HTTP ${status}. Verify the saved host URL, reverse proxy, and agent service.`;
  }

  if (status === 502) {
    return diagnostic
      ? `Dockerdash could not reach the Watchtower agent: ${diagnostic}`
      : 'Dockerdash could not reach the Watchtower agent. Verify the saved host URL and that the agent service is running.';
  }

  if (diagnostic) {
    return `The Watchtower agent returned HTTP ${status}: ${diagnostic}`;
  }

  return `The Watchtower agent returned HTTP ${status}.`;
}

export function classifyHostMetricsFailure(status: number, details: unknown) {
  if (isAgentDockerSocketFailure(details)) {
    return {
      error: 'Docker socket unavailable',
      code: 'docker_socket_unavailable',
      details,
      upstream_status: status,
    };
  }

  if (status === 404 || status === 405) {
    return {
      error: 'Host metrics endpoint unsupported',
      code: 'metrics_endpoint_unsupported',
      details,
      upstream_status: status,
    };
  }

  if (status === 504) {
    return {
      error: 'Host metrics request timed out',
      code: 'agent_timeout',
      details,
      upstream_status: status,
    };
  }

  if (status === 502) {
    return {
      error: 'Host metrics connection failed',
      code: 'agent_connection_failed',
      details,
      upstream_status: status,
    };
  }

  return {
    error: 'Host metrics unavailable',
    code: 'host_metrics_unavailable',
    details,
    upstream_status: status,
  };
}

export function classifyDockerProxyFailure(status: number, details: unknown) {
  if (isAgentDockerSocketFailure(details)) {
    return {
      error: 'Docker socket unavailable',
      code: 'docker_socket_unavailable',
      details,
      upstream_status: status,
    };
  }

  if (status === 404 || status === 405) {
    return {
      error: 'Docker API endpoint unsupported',
      code: 'docker_endpoint_unsupported',
      details,
      upstream_status: status,
    };
  }

  if (status === 504) {
    return {
      error: 'Docker API request timed out',
      code: 'agent_timeout',
      details,
      upstream_status: status,
    };
  }

  if (status === 502) {
    return {
      error: 'Docker API connection failed',
      code: 'agent_connection_failed',
      details,
      upstream_status: status,
    };
  }

  return {
    error: `Docker API error: ${status}`,
    code: 'docker_api_error',
    details,
    upstream_status: status,
  };
}

export function classifyTopLevelProxyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = message.toLowerCase();

  if (lower.includes("sync pending")) {
    return { status: 202, title: "Sync pending", detail: message, type: "sync_pending" };
  }

  if (lower.includes("forbidden") || lower.includes("awaiting platform approval") || lower.includes("disabled by a platform administrator")) {
    return { status: 403, title: "Forbidden", detail: message, type: "forbidden" };
  }

  if (lower.includes("unauthorized")) {
    return { status: 401, title: "Unauthorized", detail: message, type: "unauthorized" };
  }

  if (lower.includes("no active organization selected")) {
    return { status: 409, title: "No active organization selected", detail: message, type: "missing_organization" };
  }

  return { status: 502, title: "Docker connection failed", detail: message, type: "docker_connection_failed" };
}
