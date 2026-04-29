import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch, buildApiErrorMessage, summarizeApiErrorText } from "@/lib/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("does not call protected APIs when Clerk has no session token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      Clerk: {
        loaded: true,
        session: {
          getToken: vi.fn().mockResolvedValue(null),
        },
      },
    });

    await expect(apiFetch("/docker-proxy", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 401,
      code: "missing_session_token",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
