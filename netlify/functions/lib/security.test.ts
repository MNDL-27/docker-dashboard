import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.mjs", () => ({
  sql: vi.fn(),
}));

import { sql } from "./db.mjs";
import { buildCorsHeaders, checkRateLimit, getAllowedOrigin, TRUSTED_ORIGINS, verifyWebhookTimestamp } from "./security.mts";

const mockedSql = vi.mocked(sql);

afterEach(() => {
  mockedSql.mockReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("security CORS helpers", () => {
  it("allows only trusted origins", () => {
    expect(getAllowedOrigin("https://dockerdash.app")).toBe("https://dockerdash.app");
    expect(getAllowedOrigin("https://evil.example.com")).toBeNull();
    expect(getAllowedOrigin("not-a-url")).toBeNull();
  });

  it("includes only production-safe allowed headers", () => {
    const req = new Request("https://dockerdash.app/.netlify/functions/api-test", {
      headers: {
        origin: "https://dockerdash.app",
      },
    });

    const headers = buildCorsHeaders(req);
    const allowedHeaders = headers["Access-Control-Allow-Headers"];

    expect(allowedHeaders).toContain("Content-Type");
    expect(allowedHeaders).toContain("Authorization");
    expect(allowedHeaders).toContain("Idempotency-Key");
    expect(allowedHeaders).toContain("X-Idempotency-Key");

    expect(allowedHeaders).not.toMatch(/x-test-/i);
    expect(allowedHeaders).not.toContain("X-Test-Bypass");
    expect(allowedHeaders).not.toContain("X-Test-User-Id");
    expect(allowedHeaders).not.toContain("X-Test-Org-Id");
    expect(allowedHeaders).not.toContain("X-Test-Platform-Admin");
    expect(allowedHeaders).not.toContain("X-Test-Email");
  });

  it("does not set allow-origin for untrusted origins", () => {
    const req = new Request("https://dockerdash.app/.netlify/functions/api-test", {
      headers: {
        origin: "https://evil.example.com",
      },
    });

    const headers = buildCorsHeaders(req);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("does not warn for requests with no Origin header", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = new Request("https://dockerdash.app/.netlify/functions/api-test");

    const headers = buildCorsHeaders(req);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns and blocks explicit null origins", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = new Request("https://dockerdash.app/.netlify/functions/api-test", {
      headers: {
        origin: "null",
      },
    });

    const headers = buildCorsHeaders(req);

    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[CORS] Blocked untrusted origin: null");
  });

  it("keeps localhost origins in trusted set for local development", () => {
    expect(TRUSTED_ORIGINS.has("http://localhost:8080")).toBe(true);
  });
});

describe("distributed security persistence", () => {
  it("uses shared SQL storage for rate limiting windows", async () => {
    mockedSql.mockImplementation(async (queryParts: TemplateStringsArray) => {
      if (queryParts[0].includes("INSERT INTO public.security_rate_limits")) {
        return [{ count: 1, reset_at_ms: String(60_000) }];
      }
      return [];
    });

    const result = await checkRateLimit("api:127.0.0.1", { windowMs: 60_000, maxRequests: 3 });

    expect(mockedSql).toHaveBeenCalled();
    expect(result).toEqual({
      allowed: true,
      remaining: 2,
      resetAt: 60_000,
    });
  });

  it("blocks requests once the shared counter exceeds the configured maximum", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:30.000Z"));
    mockedSql.mockImplementation(async (queryParts: TemplateStringsArray) => {
      if (queryParts[0].includes("INSERT INTO public.security_rate_limits")) {
        return [{ count: 4, reset_at_ms: String(Date.parse("2026-04-18T00:01:00.000Z")) }];
      }
      return [];
    });

    const result = await checkRateLimit("api:127.0.0.1", { windowMs: 60_000, maxRequests: 3 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBe(30);
  });

  it("rejects duplicate webhook nonces using shared SQL persistence", async () => {
    mockedSql.mockImplementation(async () => []);

    const result = await verifyWebhookTimestamp(String(Math.floor(Date.now() / 1000)), "nonce-1", 300);

    expect(result).toEqual({ valid: false, error: "Duplicate nonce" });
    expect(mockedSql).toHaveBeenCalled();
  });
});
