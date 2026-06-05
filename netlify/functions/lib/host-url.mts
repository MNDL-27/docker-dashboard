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

function decodeIpv4MappedToV4(hostname: string): string | null {
  // Node's URL normalizes ::ffff:1.2.3.4 to ::ffff:HHHH:HHHH (no dots).
  // Match the IPv4-mapped prefix and decode the embedded IPv4.
  const m = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  if (hi > 0xffff || lo > 0xffff) return null;
  const a = (hi >> 8) & 0xff;
  const b = hi & 0xff;
  const c = (lo >> 8) & 0xff;
  const d = lo & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

const IPV6_BLOCKED_PREFIXES: Array<{ prefix: string; description: string }> = [
  { prefix: "::1", description: "loopback" },
  { prefix: "::", description: "unspecified" },
  { prefix: "fc", description: "unique-local fc00::/7" },
  { prefix: "fd", description: "unique-local fc00::/7" },
  { prefix: "fe80:", description: "link-local fe80::/10" },
  { prefix: "fec0:", description: "deprecated site-local" },
  { prefix: "ff00::", description: "multicast ff00::/8" },
  { prefix: "ff01::", description: "multicast ff01::/8" },
  { prefix: "ff02::", description: "multicast ff02::/8" },
  { prefix: "ff03::", description: "multicast ff03::/8" },
  { prefix: "ff04::", description: "multicast ff04::/8" },
  { prefix: "ff05::", description: "multicast ff05::/8" },
  { prefix: "ff06::", description: "multicast ff06::/8" },
  { prefix: "ff07::", description: "multicast ff07::/8" },
  { prefix: "ff08::", description: "multicast ff08::/8" },
  { prefix: "ff09::", description: "multicast ff09::/8" },
  { prefix: "ff0a::", description: "multicast ff0a::/8" },
  { prefix: "ff0b::", description: "multicast ff0b::/8" },
  { prefix: "ff0c::", description: "multicast ff0c::/8" },
  { prefix: "ff0d::", description: "multicast ff0d::/8" },
  { prefix: "ff0e::", description: "multicast ff0e::/8" },
  { prefix: "ff0f::", description: "multicast ff0f::/8" },
  { prefix: "100:", description: "discard 100::/64" },
  { prefix: "2001:db8:", description: "documentation 2001:db8::/32" },
  { prefix: "::ffff:", description: "IPv4-mapped" },
  { prefix: "64:ff9b:", description: "IPv4-IPv6 translation" },
];

function isBlockedIpv6(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  for (const { prefix } of IPV6_BLOCKED_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(prefix)) return true;
  }
  return false;
}

function isPrivateOrBlockedAddress(hostname: string, ipVersion: number): boolean {
  if (ipVersion === 4) {
    return isPrivateIpv4(hostname);
  }
  if (ipVersion === 6) {
    if (isBlockedIpv6(hostname)) {
      // For IPv4-mapped IPv6 (::ffff:HHHH:HHHH) we already block on prefix,
      // but also re-check the decoded IPv4 against the IPv4 private range so
      // a public IPv4-mapped address is allowed while private is rejected.
      if (/^::ffff:/i.test(hostname)) {
        const innerV4 = decodeIpv4MappedToV4(hostname);
        if (!innerV4) return true;
        return isPrivateIpv4(innerV4);
      }
      return true;
    }
    return false;
  }
  return false;
}

function allowLocalAgentUrls() {
  return process.env.NODE_ENV !== "production";
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

  const hostname = parsed.hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    throw new Error("host_url must include a hostname");
  }

  const ipVersion = isIP(hostname);
  const isLocal = isLocalHostname(hostname);

  if (parsed.protocol === "http:") {
    if (!isLocal || !allowLocalAgentUrls()) {
      throw new Error("host_url must use https unless local agent URLs are explicitly allowed for development");
    }
  } else if (parsed.protocol !== "https:") {
    throw new Error("host_url must use https");
  }

  if (isLocal) {
    if (!allowLocalAgentUrls()) {
      throw new Error("host_url cannot target localhost in this environment");
    }
  } else if (isPrivateOrBlockedAddress(hostname, ipVersion)) {
    throw new Error("host_url cannot target private, loopback, link-local, or unique-local ranges");
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

  const hostname = parsed.hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    throw new Error("URL must include a hostname");
  }

  const ipVersion = isIP(hostname);
  if (isLocalHostname(hostname)) {
    throw new Error("URL cannot target localhost");
  }
  if (isPrivateOrBlockedAddress(hostname, ipVersion)) {
    throw new Error("URL cannot target private, loopback, link-local, or unique-local ranges");
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
