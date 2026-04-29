/**
 * Sanitize raw API/connection error messages into user-friendly copy.
 * Strips technical noise (HTTP codes, raw HTML page titles, Cloudflare
 * diagnostic dumps) and returns a short, actionable sentence.
 */

interface SanitizedError {
  /** A short, human-readable headline (≤ 6 words). */
  title: string;
  /** A concise actionable description. */
  description: string;
  /** The original raw error message, useful for support links. */
  raw: string;
}

const CLOUDFLARE_PATTERNS = [
  /cloudflare/i,
  /cf-ray/i,
  /cloudflare tunnel error/i,
  /cloudflare html error/i,
];

const TIMEOUT_PATTERNS = [
  /timed?\s?out/i,
  /did not respond in time/i,
  /ETIMEDOUT/i,
  /timeout/i,
  /504/,
];

const UNREACHABLE_PATTERNS = [
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ENETUNREACH/i,
  /could not reach/i,
  /connection.*refused/i,
  /502/,
];

const AGENT_AUTH_PATTERNS = [
  /agent_auth_failed/i,
  /agent_unauthorized/i,
  /invalid api key/i,
  /invalid agent api key/i,
  /rejected the saved api key/i,
];

const DOCKERDASH_EDGE_PATTERNS = [
  /cloudflare gateway error:/i,
  /app\.dockerdash\.app/i,
  /dockerdash\.app\s*\|\s*502/i,
];

function isCloudflareError(msg: string) {
  return CLOUDFLARE_PATTERNS.some((pattern) => pattern.test(msg));
}

function isDockerdashEdgeError(msg: string) {
  return DOCKERDASH_EDGE_PATTERNS.some((pattern) => pattern.test(msg));
}

function isTimeoutError(msg: string) {
  return TIMEOUT_PATTERNS.some((pattern) => pattern.test(msg));
}

function isUnreachableError(msg: string) {
  return UNREACHABLE_PATTERNS.some((pattern) => pattern.test(msg));
}

function stringifyStructuredError(error: unknown) {
  if (!error || typeof error !== "object") return "";

  const record = error as {
    code?: unknown;
    details?: unknown;
    body?: {
      code?: unknown;
      type?: unknown;
      detail?: unknown;
      details?: unknown;
      error?: unknown;
      title?: unknown;
    };
  };
  const values = [
    record.code,
    record.details,
    record.body?.code,
    record.body?.type,
    record.body?.detail,
    record.body?.details,
    record.body?.error,
    record.body?.title,
  ];

  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function isAgentAuthError(msg: string, error: unknown) {
  const haystack = `${msg} ${stringifyStructuredError(error)}`;
  return AGENT_AUTH_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function sanitizeConnectionError(error: unknown): SanitizedError {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  if (isAgentAuthError(raw, error)) {
    return {
      title: "API key mismatch",
      description:
        "The agent is reachable, but it rejected the saved API key. Re-enter the key from /etc/watchtower-agent/watchtower-agent.env or run the agent repair command so both sides use the same key.",
      raw,
    };
  }

  if (isTimeoutError(raw)) {
    return {
      title: "Connection timed out",
      description:
        "The agent did not respond in time. Make sure the Watchtower agent process is running and the host is reachable.",
      raw,
    };
  }

  if (isCloudflareError(raw)) {
    if (isDockerdashEdgeError(raw)) {
      return {
        title: "Dockerdash gateway error",
        description:
          "Dockerdash returned a gateway error before the agent response could be classified. Retry, then check the saved host URL and API key if it persists.",
        raw,
      };
    }

    return {
      title: "Tunnel unreachable",
      description:
        "Cloudflare could not reach the Watchtower agent. Check that the tunnel is active, the route is correctly configured, and the agent service is running.",
      raw,
    };
  }

  if (isUnreachableError(raw)) {
    return {
      title: "Host unreachable",
      description:
        "The dashboard could not connect to the Watchtower agent. Verify the host URL, ensure the agent is running, and check any firewall rules.",
      raw,
    };
  }

  // Catch-all: strip "Connection test failed:" prefix if present
  const cleaned = raw.replace(/^Connection test failed:\s*/i, "").trim();

  return {
    title: "Connection failed",
    description: cleaned || "The host could not be reached. Check the agent service and network configuration.",
    raw,
  };
}
