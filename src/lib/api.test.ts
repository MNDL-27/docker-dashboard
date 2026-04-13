import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves structured API error details and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            error: "Host metrics endpoint unsupported",
            code: "metrics_endpoint_unsupported",
            details: { error: "Not found" },
            upstream_status: 404,
          }),
        ),
      }),
    );

    await expect(apiFetch("/docker-proxy")).rejects.toMatchObject({
      name: "ApiError",
      message: "Host metrics endpoint unsupported",
      status: 404,
      code: "metrics_endpoint_unsupported",
      details: { error: "Not found" },
      upstreamStatus: 404,
    });
  });
});
