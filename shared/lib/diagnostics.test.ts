import { describe, expect, it } from "vitest";

import { parseDiagnosticPayload, summarizeDiagnosticText } from "./diagnostics";

describe("diagnostics", () => {
  it("summarizes Cloudflare HTML error pages into a short message", () => {
    const raw = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>dockerdash.app | 502: Bad gateway</title>
        </head>
        <body>cloudflare</body>
      </html>
    `;

    expect(summarizeDiagnosticText(raw)).toBe(
      "Cloudflare HTML error page: dockerdash.app | 502: Bad gateway",
    );
  });

  it("parses JSON diagnostics when available", () => {
    expect(parseDiagnosticPayload('{"error":"boom","code":"agent_connection_failed"}')).toEqual({
      error: "boom",
      code: "agent_connection_failed",
    });
  });

  it("trims plain text diagnostics", () => {
    expect(parseDiagnosticPayload("  upstream timed out   ")).toBe("upstream timed out");
  });
});
