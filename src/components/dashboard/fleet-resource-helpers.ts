import type { FleetMetrics } from "@/hooks/useFleetMetrics";

const MOCK_TOTAL_CORES = 4;
const MOCK_MEMORY_LIMIT_BYTES = 8 * 1024 * 1024 * 1024;

export function buildInitialFleetData(maxDataPoints: number): FleetMetrics[] {
  const now = new Date();
  const data: FleetMetrics[] = [];
  for (let i = maxDataPoints - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 60000);
    const cpu = Math.max(0, Math.min(100, 30 + Math.random() * 20));
    const memory = Math.max(0, Math.min(100, 45 + Math.random() * 20));
    data.push({
      timestamp: date.getTime(),
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      cpu,
      memory,
      usedCores: (cpu / 100) * MOCK_TOTAL_CORES,
      totalCores: MOCK_TOTAL_CORES,
      memoryUsed: (memory / 100) * MOCK_MEMORY_LIMIT_BYTES,
      memoryLimit: MOCK_MEMORY_LIMIT_BYTES,
      networkInBytesPerSec: null,
      networkOutBytesPerSec: null,
      diskReadBytesPerSec: null,
      diskWriteBytesPerSec: null,
    });
  }
  return data;
}
