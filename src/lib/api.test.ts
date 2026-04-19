import { describe, expect, it } from "vitest";

import { buildApiErrorMessage, summarizeApiErrorText } from "@/lib/api";

describe("api error normalization", () => {
  it("uses RFC7807 problem details when present", () => {
    expect(
      buildApiErrorMessage(
        502,
        {
          title: "Connection test failed",
          detail: "Cloudflare Tunnel could not reach your Watchtower agent.",
        },
        "",
      ),
    ).toBe("Connection test failed: Cloudflare Tunnel could not reach your Watchtower agent.");
  });

  it("summarizes Cloudflare HTML 502 pages into a readable message", () => {
    const raw = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>dockerdash.app | 502: Bad gateway</title>
        </head>
        <body>cloudflare</body>
      </html>
    `;

    expect(summarizeApiErrorText(raw, 502)).toBe(
      "Cloudflare gateway error: dockerdash.app | 502: Bad gateway. Verify the saved host URL, tunnel or reverse proxy, and the Watchtower agent service.",
    );
  });

  it("preserves legacy error plus details payloads", () => {
    expect(
      buildApiErrorMessage(
        502,
        {
          error: "Agent connection failed",
          details: "connect ECONNREFUSED 127.0.0.1:9876",
        },
        "",
      ),
    ).toBe("Agent connection failed: connect ECONNREFUSED 127.0.0.1:9876");
  });
});
