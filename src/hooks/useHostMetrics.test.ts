import { describe, expect, it } from "vitest";
import { transformApiMetrics } from "@/lib/metrics-transformer";

describe("transformApiMetrics", () => {
  it("successfully normalizes a valid camelCase sample", () => {
    const raw = {
      timestamp: 1625097600000,
      cpu: 45,
      memory: 60,
      usedCores: 2,
      totalCores: 4,
      memoryUsed: 8000000000,
      memoryLimit: 16000000000,
    };
    const result = transformApiMetrics(raw);
    expect(result).not.toBeNull();
    expect(result?.cpu).toBe(45);
    expect(result?.totalCores).toBe(4);
  });

  it("successfully normalizes a valid snake_case sample", () => {
    const raw = {
      timestamp: 1625097600000,
      cpu: 45,
      memory: 60,
      used_cores: 2,
      total_cores: 4,
      memory_used: 8000000000,
      memory_limit: 16000000000,
    };
    const result = transformApiMetrics(raw as any);
    expect(result).not.toBeNull();
    expect(result?.usedCores).toBe(2);
    expect(result?.totalCores).toBe(4);
  });

  it("sets core fields to null if missing", () => {
    const raw = {
      timestamp: 1625097600000,
      cpu: 45,
      // memory missing
      usedCores: 2,
      totalCores: 4,
      memoryUsed: 8000000000,
      memoryLimit: 16000000000,
    };
    const result = transformApiMetrics(raw as any);
    expect(result.memory).toBeNull();
  });

  it("clamps out of range values", () => {
    const raw = {
      timestamp: 1625097600000,
      cpu: 105, // > 100
      memory: -10, // < 0
      usedCores: 10, 
      totalCores: 4, // used > total
      memoryUsed: 20000000000,
      memoryLimit: 16000000000, // used > limit
    };
    const result = transformApiMetrics(raw as any);
    expect(result).not.toBeNull();
    expect(result?.cpu).toBe(100);
    expect(result?.memory).toBe(0);
    expect(result?.usedCores).toBe(4); // clamped to total
    expect(result?.memoryUsed).toBe(16000000000); // clamped to limit
  });

  it("handles empty strings and nulls correctly in toFiniteNumber", () => {
    const raw = {
      timestamp: 1625097600000,
      cpu: 45,
      memory: 60,
      usedCores: 2,
      totalCores: 4,
      memoryUsed: 8000000000,
      memoryLimit: 16000000000,
      networkInBytesPerSec: "", // Should become null, not 0
    };
    const result = transformApiMetrics(raw as any);
    expect(result?.networkInBytesPerSec).toBeNull();
  });
});
