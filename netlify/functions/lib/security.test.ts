import { describe, expect, it } from "vitest";

import { buildCorsHeaders, getAllowedOrigin, TRUSTED_ORIGINS } from "./security.mts";

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

  it("keeps localhost origins in trusted set for local development", () => {
    expect(TRUSTED_ORIGINS.has("http://localhost:8080")).toBe(true);
  });
});
