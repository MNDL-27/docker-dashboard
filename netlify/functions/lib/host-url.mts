import { isIP } from "node:net";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isTrue(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return LOCAL_HOSTS.has(normalized);
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((segment) => !Number.isInteger(segment) || segment < 0 || segment > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isBlockedIpv6(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function allowLocalAgentUrls() {
  return process.env.NODE_ENV !== "production" || isTrue(process.env.ALLOW_LOCAL_AGENT_URLS);
}

export function normalizeAndValidateHostUrl(input: string) {
  const value = input.trim();
  if (!value) {
    throw new Error("host_url is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("host_url must be a valid absolute URL");
  }

  if (parsed.username || parsed.password) {
    throw new Error("host_url must not include embedded credentials");
  }

  if (parsed.search || parsed.hash) {
    throw new Error("host_url must not include query parameters or fragments");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new Error("host_url must include a hostname");
  }

  const ipVersion = isIP(hostname);
  const isLocal = isLocalHostname(hostname);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("host_url must use http or https");
  }

  if (isLocal) {
    if (!allowLocalAgentUrls()) {
      throw new Error("host_url cannot target localhost in this environment");
    }
  } else if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    throw new Error("host_url cannot target private, loopback, or link-local IPv4 ranges");
  } else if (ipVersion === 6 && isBlockedIpv6(hostname)) {
    throw new Error("host_url cannot target loopback, link-local, or unique-local IPv6 ranges");
  }

  parsed.hostname = hostname;
  return parsed.toString().replace(/\/$/, "");
}

export function buildValidatedAgentUrl(hostUrl: string, path: string) {
  const normalizedBase = normalizeAndValidateHostUrl(hostUrl).replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function parseExternalHttpsUrl(input: string) {
  const value = input.trim();
  if (!value) {
    throw new Error("URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("URL must use https");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL must not include embedded credentials");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new Error("URL must include a hostname");
  }

  const ipVersion = isIP(hostname);
  if (isLocalHostname(hostname)) {
    throw new Error("URL cannot target localhost");
  }
  if (ipVersion === 4 && isPrivateIpv4(hostname)) {
    throw new Error("URL cannot target private, loopback, or link-local IPv4 ranges");
  }
  if (ipVersion === 6 && isBlockedIpv6(hostname)) {
    throw new Error("URL cannot target loopback, link-local, or unique-local IPv6 ranges");
  }

  parsed.hostname = hostname;
  return parsed;
}

export function normalizeAndValidateWebhookUrl(input: string) {
  return parseExternalHttpsUrl(input).toString();
}

export function normalizeAndValidateSlackWebhookUrl(input: string) {
  const parsed = parseExternalHttpsUrl(input);
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "hooks.slack.com") {
    throw new Error("Slack webhook URL must target hooks.slack.com");
  }
  if (!parsed.pathname.startsWith("/services/")) {
    throw new Error("Slack webhook URL must use the standard /services/ path");
  }
  return parsed.toString();
}
