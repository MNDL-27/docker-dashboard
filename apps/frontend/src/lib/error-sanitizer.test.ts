import { describe, expect, it } from "vitest";

import { sanitizeConnectionError } from "@/lib/error-sanitizer";

describe("sanitizeConnectionError", () => {
  it("prioritizes agent API key failures over Cloudflare wording", () => {
    const error = Object.assign(
      new Error("Connection test failed: Cloudflare Tunnel returned HTTP 401: Invalid API key"),
      { body: { code: "agent_auth_failed", type: "agent_unauthorized" } },
    );

    expect(sanitizeConnectionError(error)).toMatchObject({
      title: "API key mismatch",
    });
  });

  it("does not classify the Dockerdash app edge 502 as a host tunnel outage", () => {
    expect(
      sanitizeConnectionError(
        "Cloudflare gateway error: app.dockerdash.app | 502: Bad gateway. Verify the saved host URL.",
      ),
    ).toMatchObject({
      title: "Dockerdash gateway error",
    });
  });

  it("classifies agent-side Docker socket failures separately from reachability", () => {
    const error = Object.assign(
      new Error(
        "Docker socket unavailable: The Watchtower agent is reachable, but it could not talk to Docker through its configured socket.",
      ),
      {
        body: {
          type: "docker_socket_unavailable",
          detail: "Docker API request failed",
        },
      },
    );

    expect(sanitizeConnectionError(error)).toMatchObject({
      title: "Docker socket inaccessible",
    });
  });

  it("keeps Cloudflare reachability copy for real tunnel failures", () => {
    expect(sanitizeConnectionError("Cloudflare HTML error page: 502 Bad Gateway")).toMatchObject({
      title: "Tunnel unreachable",
    });
  });
});
