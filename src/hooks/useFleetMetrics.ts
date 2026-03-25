import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface FleetMetrics {
  time: string;
  cpu: number;
  memory: number;
  usedCores: number;
  totalCores: number;
  memoryUsed: number;
  memoryLimit: number;
}

export function useFleetMetrics(orgId: string | null | undefined, refetchInterval = 10000) {
  return useQuery({
    queryKey: ['fleet-metrics', orgId],
    queryFn: async (): Promise<FleetMetrics[]> => {
      if (!orgId) {
        return [];
      }

      try {
        const data = await apiFetch('/api/fleet-metrics', {
          method: 'POST',
          body: JSON.stringify({ orgId }),
        });
        return data as FleetMetrics[];
      } catch (error) {
        console.error('Failed to fetch fleet metrics:', error);
        return [];
      }
    },
    refetchInterval,
    enabled: !!orgId,
  });
}
