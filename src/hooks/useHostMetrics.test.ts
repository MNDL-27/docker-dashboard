import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import { getHostMetricsFailure, normalizeHostMetricsPoint } from "@/hooks/useHostMetrics";

describe("normalizeHostMetricsPoint", () => {
  it("normalizes a valid metrics payload", () => {
    const point = normalizeHostMetricsPoint({
      timestamp: 1710000000000,
      cpu: 42,
      memory: 38,
      usedCores: 3.36,
      totalCores: 8,
      memoryUsed: 12_000_000_000,
      memoryLimit: 32_000_000_000,
      network_in_bytes_per_sec: 1024,
      network_out_bytes_per_sec: 2048,
      disk_read_bytes_per_sec: 4096,
      disk_write_bytes_per_sec: 8192,
    });

    expect(point).toMatchObject({
      timestamp: 1710000000000,
      cpu: 42,
      memory: 38,
      usedCores: 3.36,
      totalCores: 8,
      memoryUsed: 12_000_000_000,
      memoryLimit: 32_000_000_000,
      networkInBytesPerSec: 1024,
      networkOutBytesPerSec: 2048,
      diskReadBytesPerSec: 4096,
      diskWriteBytesPerSec: 8192,
    });
  });

  it("accepts empty-workload zero-capacity payloads", () => {
    const point = normalizeHostMetricsPoint({
      cpu: 0,
      memory: 0,
      usedCores: 0,
      totalCores: 0,
      memoryUsed: 0,
      memoryLimit: 0,
      network_in_bytes_per_sec: null,
      network_out_bytes_per_sec: null,
      disk_read_bytes_per_sec: null,
      disk_write_bytes_per_sec: null,
    });

    expect(point).toMatchObject({
      cpu: 0,
      memory: 0,
      usedCores: 0,
      totalCores: 0,
      memoryUsed: 0,
      memoryLimit: 0,
      networkInBytesPerSec: null,
      networkOutBytesPerSec: null,
      diskReadBytesPerSec: null,
      diskWriteBytesPerSec: null,
    });
  });

  it("rejects inconsistent zero-capacity payloads", () => {
    expect(
      normalizeHostMetricsPoint({
        cpu: 10,
        memory: 0,
        usedCores: 0,
        totalCores: 0,
        memoryUsed: 0,
        memoryLimit: 0,
      }),
    ).toBeNull();
  });

  it("maps unsupported endpoint API failures into structured diagnostics", () => {
    expect(
      getHostMetricsFailure(
        new ApiError(
          404,
          {
            error: "Host metrics endpoint unsupported",
            code: "metrics_endpoint_unsupported",
            details: { error: "Not found" },
            upstream_status: 404,
          },
          "Host metrics endpoint unsupported",
        ),
      ),
    ).toMatchObject({
      code: "metrics_endpoint_unsupported",
      unsupportedEndpoint: true,
      upstreamStatus: 404,
    });
  });
});
