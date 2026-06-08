import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/db.mjs", () => ({
  sql: vi.fn(),
}));

vi.mock("./lib/auth.mjs", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("./lib/access-controls.mjs", () => ({
  assertHostProxyAllowed: vi.fn(),
  assertOrganizationWriteAllowed: vi.fn(),
  enforceOrganizationNodeLimit: vi.fn(),
  resolveOrganizationEntitlements: vi.fn(),
}));

vi.mock("./lib/crypto.mjs", () => ({
  decryptHostSecrets: vi.fn(),
  SecretCryptoError: class SecretCryptoError extends Error {},
}));

vi.mock("./lib/agent-release.mts", () => ({
  buildWatchtowerAgentReleaseResponse: vi.fn(),
}));

vi.mock("./lib/ensure-docker-host-schema.mjs", () => ({
  ensureDockerHostSchema: vi.fn(),
}));

vi.mock("./lib/security.mts", () => ({
  buildCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "https://dockerdash.app" })),
  applyRateLimit: vi.fn(async () => null),
  RATE_LIMITS: { PROXY: { maxRequests: 600, windowMs: 60_000 } },
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => "203.0.113.10"),
}));

vi.mock("./lib/tar-directory-parser.mts", () => ({
  parseTarDirectory: vi.fn(),
  buildDirectoryTar: vi.fn(),
}));

import { sql } from "./lib/db.mjs";
import { requireAuth } from "./lib/auth.mjs";
import {
  assertHostProxyAllowed,
  assertOrganizationWriteAllowed,
  enforceOrganizationNodeLimit,
  resolveOrganizationEntitlements,
} from "./lib/access-controls.mjs";
import { decryptHostSecrets } from "./lib/crypto.mjs";
import { buildWatchtowerAgentReleaseResponse } from "./lib/agent-release.mts";
import { ensureDockerHostSchema } from "./lib/ensure-docker-host-schema.mjs";
import {
  applyRateLimit,
  buildCorsHeaders,
  logSecurityEvent,
} from "./lib/security.mts";
import { parseTarDirectory } from "./lib/tar-directory-parser.mts";

import handler, { config } from "./api-docker-proxy.mts";

const mockedSql = vi.mocked(sql);
const mockedRequireAuth = vi.mocked(requireAuth);
const mockedAssertHostProxyAllowed = vi.mocked(assertHostProxyAllowed);
const mockedAssertOrganizationWriteAllowed = vi.mocked(assertOrganizationWriteAllowed);
const mockedEnforceOrganizationNodeLimit = vi.mocked(enforceOrganizationNodeLimit);
const mockedResolveOrganizationEntitlements = vi.mocked(resolveOrganizationEntitlements);
const mockedDecryptHostSecrets = vi.mocked(decryptHostSecrets);
const mockedBuildWatchtowerAgentReleaseResponse = vi.mocked(buildWatchtowerAgentReleaseResponse);
const mockedEnsureDockerHostSchema = vi.mocked(ensureDockerHostSchema);
const mockedApplyRateLimit = vi.mocked(applyRateLimit);
const mockedBuildCorsHeaders = vi.mocked(buildCorsHeaders);
const mockedLogSecurityEvent = vi.mocked(logSecurityEvent);
const mockedParseTarDirectory = vi.mocked(parseTarDirectory);

interface MockAgentRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

type MockHandler = (req: MockAgentRequest) => Response | Promise<Response>;

interface MockAgentOptions {
  defaultHandler?: MockHandler;
  routes?: Record<string, MockHandler>;
  onRequest?: (req: MockAgentRequest) => void;
}

function installMockAgent(options: MockAgentOptions = {}) {
  const requests: MockAgentRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init?.method ?? "GET").toString().toUpperCase();
    const headers = toHeaderRecord(init?.headers);
    const body = init?.body ? String(init.body) : undefined;
    const record: MockAgentRequest = { url, method, headers, body };
    requests.push(record);

    const u = new URL(url);
    if (options.onRequest) options.onRequest(record);

    const routeMatch = matchRoute(u.pathname, options.routes);
    if (routeMatch) {
      return await routeMatch(record);
    }

    if (options.defaultHandler) {
      return await options.defaultHandler(record);
    }

    return new Response(JSON.stringify({ error: "no mock handler" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return { fetchMock, requests };
}

function toHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[key] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) out[key] = String(value);
  }
  return out;
}

function matchRoute(pathname: string, routes?: Record<string, MockHandler>): MockHandler | null {
  if (!routes) return null;
  for (const [pattern, handler] of Object.entries(routes)) {
    if (pattern === pathname) return handler;
    if (pattern.endsWith("*") && pathname.startsWith(pattern.slice(0, -1))) return handler;
    if (pattern.includes(":")) {
      const regex = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
      if (regex.test(pathname)) return handler;
    }
  }
  return null;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const HOST_A_ID = "33333333-3333-3333-3333-333333333333";
const HOST_B_ID = "44444444-4444-4444-4444-444444444444";
const HOST_A_URL = "https://agent-a.example.com";
const HOST_B_URL = "https://agent-b.example.com";

const DEFAULT_AUTH = {
  userId: USER_ID,
  orgId: ORG_ID,
  clerkUserId: "user_abc",
  clerkOrgId: "org_abc",
  isPlatformAdmin: false,
  email: "qa@example.com",
};

const DEFAULT_ENTITLEMENTS = {
  canUseLogs: true,
  logTailLines: 4000,
  maxPayloadBytes: 8 * 1024 * 1024,
  canUseFileManager: true,
  canMonitorWithoutDocker: false,
};

const DEFAULT_RELEASE_RESPONSE = {
  latest_agent_version: "1.2.3",
  agent_update_available: false,
  agent_update_status: "up_to_date" as const,
  current_agent_version: "1.2.3",
  preflight_command: "echo preflight",
  upgrade_command: "echo upgrade",
  verify_command: "echo verify",
  repair_command: "echo repair",
  source_label: "latest",
  published_release: true,
  release_url: "https://example.com/release",
  release_notes_url: "https://example.com/release/notes",
  checksum: "abc123",
  install_command: "echo install",
  advanced_manual_command: "echo manual",
  setup_summary: "setup",
  verify_summary: "verify",
  next_step_summary: "next",
  mode_label: "auto",
};

function makeHost(overrides: Partial<{
  id: string;
  organization_id: string;
  name: string;
  host_url: string;
  connection_mode: string;
  docker_socket_path: string;
}> = {}) {
  return {
    id: HOST_A_ID,
    organization_id: ORG_ID,
    name: "Host A",
    host_url: HOST_A_URL,
    connection_mode: "agent",
    docker_socket_path: "/var/run/docker.sock",
    ...overrides,
  };
}

function makeSealedSecrets() {
  return {
    agent_api_key: "agent-key-aaa",
    cf_service_token_id: null,
    cf_service_token_secret: null,
  };
}

function installDefaultMocks() {
  mockedRequireAuth.mockResolvedValue(DEFAULT_AUTH);
  mockedEnforceOrganizationNodeLimit.mockResolvedValue({
    allowedHostIds: [HOST_A_ID, HOST_B_ID],
    limit: 10,
    activeCount: 2,
  });
  mockedAssertHostProxyAllowed.mockResolvedValue(undefined);
  mockedAssertOrganizationWriteAllowed.mockResolvedValue(undefined);
  mockedResolveOrganizationEntitlements.mockResolvedValue(DEFAULT_ENTITLEMENTS);
  mockedDecryptHostSecrets.mockReturnValue(makeSealedSecrets());
  mockedBuildWatchtowerAgentReleaseResponse.mockReturnValue(DEFAULT_RELEASE_RESPONSE);
  mockedEnsureDockerHostSchema.mockResolvedValue(undefined);
  mockedApplyRateLimit.mockResolvedValue(null);
  mockedBuildCorsHeaders.mockReturnValue({ "Access-Control-Allow-Origin": "https://dockerdash.app" });
  mockedLogSecurityEvent.mockReturnValue(undefined);
  mockedParseTarDirectory.mockReturnValue([]);
}

function buildRequest(body: unknown, init: RequestInit = {}): Request {
  const url = init.url ?? "https://dockerdash.app/.netlify/functions/api-docker-proxy";
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-test-001",
      ...(init.headers as Record<string, string> | undefined),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function configureMembershipLookup() {
  mockedSql.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    if (query.includes("SELECT 1 FROM organization_members") && query.includes("user_id")) {
      return [{ "?column?": 1 }];
    }
    if (query.includes("docker_hosts h") && query.includes("JOIN organization_members")) {
      return [makeHost({ id: HOST_A_ID, name: "Host A", host_url: HOST_A_URL })];
    }
    if (query.includes("docker_hosts h") && query.includes("ANY(")) {
      return [
        makeHost({ id: HOST_A_ID, name: "Host A", host_url: HOST_A_URL }),
        makeHost({ id: HOST_B_ID, name: "Host B", host_url: HOST_B_URL }),
      ];
    }
    if (query.includes("SELECT agent_api_key, cf_service_token_id, cf_service_token_secret")) {
      return [{ agent_api_key: "encrypted:abc", cf_service_token_id: null, cf_service_token_secret: null }];
    }
    if (query.includes("UPDATE docker_hosts")) {
      return [];
    }
    if (query.includes("host_network_usage")) {
      return [{ accumulated_rx: 0, accumulated_tx: 0 }];
    }
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installDefaultMocks();
  configureMembershipLookup();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api-docker-proxy integration suite", () => {
  describe("config", () => {
    it("registers the canonical route", () => {
      expect(config).toEqual({ path: "/api/docker-proxy" });
    });
  });

  describe("successful proxy operations", () => {
    it("pings a host, returns ok=true with version metadata", async () => {
      const { requests } = installMockAgent({
        routes: {
          "/docker/_ping": () => new Response("OK"),
          "/docker/version": () => jsonResponse({ Version: "24.0.7", ApiVersion: "1.43", Os: "linux", Arch: "x86_64" }),
          "/agent/version": () => jsonResponse({ agent_version: "1.2.3" }),
        },
      });

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.docker_version).toBe("24.0.7");
      expect(body.agent_version).toBe("1.2.3");
      expect(body.os_info).toBe("linux/x86_64");
      expect(body.connection_mode).toBe("agent");
      expect(body.agent_update_status).toBe("up_to_date");
      expect(body.agent_update_available).toBe(false);

      const agentKey = requests.find((r) => r.url.includes("/docker/_ping"))?.headers["X-Agent-Key"];
      expect(agentKey).toBe("agent-key-aaa");
    });

    it("proxies container-logs and parses Docker log frames", async () => {
      // Docker log frame: 8-byte header where bytes 4-7 are the size (big-endian uint32).
      const header = new Uint8Array(8);
      const payload = new TextEncoder().encode("container started\n");
      new DataView(header.buffer).setUint32(4, payload.byteLength);
      const tar = new Uint8Array(header.byteLength + payload.byteLength);
      tar.set(header, 0);
      tar.set(payload, header.byteLength);

      installMockAgent({
        routes: {
          "/docker/containers/abc123def4567890/json": () => jsonResponse({ Id: "abc123def4567890" }),
        },
        defaultHandler: () => new Response(tar, { headers: { "Content-Type": "application/octet-stream" } }),
      });

      const response = await handler(buildRequest({
        action: "container-logs",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
        params: { tail: 100 },
      }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.logs).toEqual(["container started"]);
    });

    it("returns normalized host-metrics point and persists usage", async () => {
      installMockAgent({
        routes: {
          "/metrics": () => jsonResponse({
            cpu_time_ns: 5_000_000_000,
            system_time_ns: 10_000_000_000,
            online_cpus: 4,
            memory_used: 512 * 1024 * 1024,
            memory_limit: 1024 * 1024 * 1024,
            uptime_seconds: 3600,
            network_rx_total: 12345,
            network_tx_total: 67890,
          }),
          "/agent/version": () => jsonResponse({ agent_version: "1.2.3" }),
        },
      });

      const response = await handler(buildRequest({ action: "host-metrics", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.totalCores).toBe(4);
      expect(body.memoryLimit).toBe(1024 * 1024 * 1024);
      expect(body.uptimeSeconds).toBe(3600);
    });

    it("fans out all-containers across multiple hosts with host metadata", async () => {
      installMockAgent({
        routes: {
          "/docker/containers/json": () => jsonResponse([
            { Id: "aaaa1111aaaa", Names: ["/web"], State: "running" },
          ]),
          "/agent/version": () => jsonResponse({ agent_version: "1.2.3" }),
        },
        defaultHandler: (req) => {
          if (req.url.includes("containers/json?all=true")) {
            return jsonResponse([{ Id: "bbbb2222bbbb", Names: ["/api"], State: "running" }]);
          }
          return new Response("not found", { status: 404 });
        },
      });

      const response = await handler(buildRequest({ action: "all-containers" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      const hostIds = body.map((c: { _hostId: string }) => c._hostId);
      expect(new Set(hostIds)).toEqual(new Set([HOST_A_ID, HOST_B_ID]));
    });

    it("fans out all-container-stats and computes CPU percent", async () => {
      installMockAgent({
        routes: {
          "/agent/version": () => jsonResponse({ agent_version: "1.2.3" }),
        },
        defaultHandler: (req) => {
          if (req.url.includes("/containers/json") && !req.url.includes("stats")) {
            return jsonResponse([{ Id: "cccc3333cccc" }]);
          }
          if (req.url.includes("/stats")) {
            return jsonResponse({
              cpu_stats: { cpu_usage: { total_usage: 2_000_000_000 }, system_cpu_usage: 10_000_000_000, online_cpus: 4 },
              precpu_stats: { cpu_usage: { total_usage: 1_000_000_000 }, system_cpu_usage: 9_000_000_000 },
              memory_stats: { usage: 100 * 1024 * 1024, limit: 1024 * 1024 * 1024 },
              networks: { eth0: { rx_bytes: 1024, tx_bytes: 2048 } },
            });
          }
          return new Response("not found", { status: 404 });
        },
      });

      const response = await handler(buildRequest({ action: "all-container-stats" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(2);
      const sample = body[0];
      expect(sample.containerId).toBe("cccc3333cccc");
      expect(sample.cpu_percent).toBeCloseTo(400, 1);
      expect(sample.memory_usage).toBe(100 * 1024 * 1024);
      expect(sample.memory_limit).toBe(1024 * 1024 * 1024);
      expect(sample.net_rx).toBe(1024);
      expect(sample.net_tx).toBe(2048);
    });

    it("performs a container-start mutation when the idempotency key is present", async () => {
      installMockAgent({
        routes: {
          "/docker/containers/abc123def4567890/start": () => new Response(null, { status: 204 }),
        },
      });

      const response = await handler(buildRequest({
        action: "container-start",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
      }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.status).toBe(204);
    });

    it("lists container files via the archive API and parses the tar stream", async () => {
      mockedParseTarDirectory.mockReturnValue([
        { name: "etc", type: "directory", size: 0, mode: "drwxr-xr-x", permissions: "drwxr-xr-x", mtime: 0 },
        { name: "etc/hostname", type: "file", size: 12, mode: "-rw-r--r--", permissions: "-rw-r--r--", mtime: 0 },
      ]);
      installMockAgent({
        routes: {
          "/docker/containers/abc123def4567890/archive": () => new Response(new Uint8Array([1, 2, 3])),
        },
      });

      const response = await handler(buildRequest({
        action: "container-fs-list",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
        params: { path: "/etc" },
      }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.path).toBe("/etc");
      expect(body.entries).toHaveLength(2);
    });
  });

  describe("authentication and authorization failures", () => {
    it("rejects unauthenticated requests with 401-classified problem", async () => {
      mockedRequireAuth.mockRejectedValueOnce(new Error("unauthorized: no session"));

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.type).toBe("unauthorized");
    });

    it("returns 403 when the user is not a member of the host's organization", async () => {
      mockedSql.mockImplementation(async (strings: TemplateStringsArray) => {
        const query = strings.join(" ");
        if (query.includes("SELECT 1 FROM organization_members")) {
          return [];
        }
        return [];
      });

      const response = await handler(buildRequest({ action: "all-containers" }));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.title).toBe("Access denied");
    });

    it("blocks the ping when the agent rejects the saved API key", async () => {
      installMockAgent({
        routes: {
          "/docker/_ping": () => jsonResponse({ error: "Invalid API key" }, { status: 401 }),
        },
      });

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.type).toBe("agent_unauthorized");
      expect(body.code).toBe("agent_auth_failed");
      expect(body.upstream_status).toBe(401);
    });

    it("blocks the host-specific mutation when the host is over the plan node limit", async () => {
      mockedEnforceOrganizationNodeLimit.mockResolvedValueOnce({
        allowedHostIds: [],
        limit: 1,
        activeCount: 5,
      });

      const response = await handler(buildRequest({
        action: "container-start",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
      }));
      const body = await response.json();

      expect(response.status).toBe(402);
      expect(body.type).toBe("host_plan_limit_exceeded");
    });

    it("rejects container-start when the Idempotency-Key header is missing", async () => {
      const req = new Request("https://dockerdash.app/.netlify/functions/api-docker-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "container-start",
          hostId: HOST_A_ID,
          containerId: "abc123def4567890",
        }),
      });

      const response = await handler(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.title).toBe("Missing Idempotency Key");
    });

    it("returns 404 when the host does not exist for the user", async () => {
      mockedSql.mockImplementation(async () => []);

      const response = await handler(buildRequest({ action: "ping", hostId: "nope" }));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.title).toBe("Host not found or access denied");
    });
  });

  describe("error handling scenarios", () => {
    it("classifies Docker socket failure during ping when the agent version is unknown", async () => {
      installMockAgent({
        routes: {
          "/docker/_ping": () => jsonResponse({ error: "docker_socket_unavailable", code: "docker_socket_unavailable" }, { status: 500 }),
          "/agent/version": () => new Response("not found", { status: 404 }),
        },
      });

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.type).toBe("docker_socket_unavailable");
    });

    it("returns the docker-missing upgrade problem when entitled monitoring is disabled", async () => {
      mockedResolveOrganizationEntitlements.mockResolvedValueOnce({
        ...DEFAULT_ENTITLEMENTS,
        canMonitorWithoutDocker: false,
      });
      installMockAgent({
        routes: {
          "/docker/_ping": () => jsonResponse({ error: "docker_socket_unavailable" }, { status: 500 }),
          "/agent/version": () => jsonResponse({ agent_version: "1.2.3" }),
        },
      });

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.type).toBe("docker_missing_upgrade_required");
    });

    it("classifies host-metrics 404 as metrics_endpoint_unsupported", async () => {
      installMockAgent({
        routes: {
          "/metrics": () => new Response("nope", { status: 404 }),
        },
      });

      const response = await handler(buildRequest({ action: "host-metrics", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.code).toBe("metrics_endpoint_unsupported");
    });

    it("classifies host-metrics 504 as agent_timeout", async () => {
      installMockAgent({
        routes: {
          "/metrics": () => jsonResponse({ error: "timeout" }, { status: 504 }),
        },
      });

      const response = await handler(buildRequest({ action: "host-metrics", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.code).toBe("agent_timeout");
    });

    it("returns 502 agent_connection_failed when the upstream host is unreachable", async () => {
      const fetchMock = vi.fn(async () => {
        throw new TypeError("fetch failed: ECONNREFUSED");
      });
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const response = await handler(buildRequest({ action: "info", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.code).toBe("agent_connection_failed");
    });

    it("parses Cloudflare HTML error pages into a short diagnostic message", async () => {
      const cfHtml = `<!DOCTYPE html><html><head><title>502: Bad gateway</title></head><body>cloudflare</body></html>`;
      installMockAgent({
        routes: {
          "/docker/_ping": () => htmlResponse(cfHtml, { status: 502 }),
        },
      });

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.detail).toMatch(/Cloudflare/i);
    });

    it("returns 413 when the agent reports a payload too large", async () => {
      const fetchMock = vi.fn(async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(64 * 1024));
          controller.enqueue(new Uint8Array(5 * 1024 * 1024));
          controller.close();
        },
      }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const response = await handler(buildRequest({ action: "containers", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(413);
      expect(body.code).toBe("docker_api_error");
    });

    it("rejects unknown actions with 400 via Zod validation", async () => {
      const response = await handler(buildRequest({ action: "nope", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.title).toBe("Validation Error");
    });

    it("rejects an invalid JSON body with 400", async () => {
      const req = new Request("https://dockerdash.app/.netlify/functions/api-docker-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{",
      });

      const response = await handler(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.title).toBe("Invalid JSON payload");
    });

    it("rejects a containerId that fails the sanitizer", async () => {
      const response = await handler(buildRequest({
        action: "container-inspect",
        hostId: HOST_A_ID,
        containerId: "drop table hosts;",
      }));
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.type).toBe("docker_connection_failed");
      expect(body.detail).toMatch(/Invalid container ID format/);
    });

    it("returns the secret storage error when crypto throws", async () => {
      const { SecretCryptoError } = await import("./lib/crypto.mts");
      mockedDecryptHostSecrets.mockImplementationOnce(() => {
        throw new SecretCryptoError("cipher mismatch");
      });

      const response = await handler(buildRequest({ action: "info", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.title).toBe("Secret storage failed");
    });
  });

  describe("timeout handling", () => {
    function throwFetchError(name: "AbortError" | "TimeoutError", message: string) {
      const fetchMock = vi.fn(async () => {
        const err = new Error(message) as Error & { name: string };
        err.name = name;
        throw err;
      });
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    }

    it("maps an AbortError during fetch to a 504 agent_timeout problem", async () => {
      throwFetchError("AbortError", "aborted");

      const response = await handler(buildRequest({ action: "info", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.code).toBe("agent_timeout");
    });

    it("maps a TimeoutError (legacy) to a 504 agent_timeout problem", async () => {
      throwFetchError("TimeoutError", "timeout");

      const response = await handler(buildRequest({ action: "info", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.code).toBe("agent_timeout");
    });

    it("surfaces a 504 status through the ping problem when the agent is silent", async () => {
      throwFetchError("AbortError", "aborted");

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.type).toBe("agent_connection_failed");
      expect(body.title).toBe("Connection test failed");
    });
  });

  describe("CORS and rate limiting", () => {
    it("answers OPTIONS preflight with the configured CORS headers", async () => {
      const req = new Request("https://dockerdash.app/.netlify/functions/api-docker-proxy", {
        method: "OPTIONS",
        headers: { Origin: "https://dockerdash.app" },
      });

      const response = await handler(req);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://dockerdash.app");
    });

    it("propagates the rate limit response when the limiter fires", async () => {
      mockedApplyRateLimit.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "30" },
        }),
      );

      const response = await handler(buildRequest({ action: "ping", hostId: HOST_A_ID }));
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error).toBe("Too Many Requests");
    });
  });

  describe("organizational fan-out resilience", () => {
    it("marks hosts as error and returns an empty array when no host is reachable", async () => {
      installMockAgent({
        defaultHandler: () => jsonResponse({ error: "down" }, { status: 502 }),
      });

      const response = await handler(buildRequest({ action: "all-containers" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    });

    it("returns an empty array when the org has no allowed host IDs", async () => {
      mockedEnforceOrganizationNodeLimit.mockResolvedValueOnce({
        allowedHostIds: [],
        limit: 1,
        activeCount: 5,
      });

      const response = await handler(buildRequest({ action: "all-containers" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    });

    it("skips hosts that throw during fan-out and still returns the rest", async () => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.startsWith(HOST_A_URL)) {
          throw new TypeError("ECONNREFUSED");
        }
        if (url.includes("/containers/json?all=true")) {
          return jsonResponse([{ Id: "ok1111ok1111", Names: ["/api"], State: "running" }]);
        }
        return jsonResponse({}, { status: 200 });
      });
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const response = await handler(buildRequest({ action: "all-containers" }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]._hostId).toBe(HOST_B_ID);
    });
  });

  describe("file manager hardening", () => {
    it("rejects fs paths containing path traversal", async () => {
      const response = await handler(buildRequest({
        action: "container-fs-list",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
        params: { path: "/etc/../shadow" },
      }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.title).toBe("Invalid path");
    });

    it("rejects fs paths that are not absolute", async () => {
      const response = await handler(buildRequest({
        action: "container-fs-list",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
        params: { path: "relative/path" },
      }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.title).toBe("Invalid path");
    });

    it("blocks fs actions when the plan does not include the file manager", async () => {
      mockedResolveOrganizationEntitlements.mockResolvedValueOnce({
        ...DEFAULT_ENTITLEMENTS,
        canUseFileManager: false,
      });

      const response = await handler(buildRequest({
        action: "container-fs-list",
        hostId: HOST_A_ID,
        containerId: "abc123def4567890",
        params: { path: "/" },
      }));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.type).toBe("feature_not_allowed");
    });
  });
});
