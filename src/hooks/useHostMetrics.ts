import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { ApiError } from "@/lib/api";
import {
  type HostMetricsPoint,
  type HostMetricsApiPoint,
  transformApiMetrics,
  getHostMetricsFailure,
} from "@/lib/metrics-transformer";

export type { HostMetricsPoint, HostMetricsDisk, HostMetricsFailure } from "@/lib/metrics-transformer";

interface UseHostMetricsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useHostMetrics(hostId?: string | null, options: UseHostMetricsOptions = {}) {
  const { enabled = true, refetchInterval = 10000 } = options;

  const query = useQuery({
    queryKey: ["host-metrics", hostId],
    queryFn: async (): Promise<HostMetricsPoint> => {
      const data = await dockerApi.hostMetrics(hostId!);
      const normalized = transformApiMetrics((data ?? {}) as HostMetricsApiPoint);
      
      // Check if at least core metrics are present
      if (normalized.cpu === null || normalized.memory === null) {
        throw new ApiError(
          502,
          {
            error: "Host metrics unavailable",
            code: "malformed_metrics_payload",
            details: "Agent returned a success response without a usable host metrics sample.",
          },
          "Host metrics unavailable",
        );
      }
      return normalized;
    },
    enabled: enabled && !!hostId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => {
      if (!enabled || !hostId) return false;
      return query.state.error || refetchInterval === false ? false : refetchInterval;
    },
  });

  return {
    ...query,
    failure: getHostMetricsFailure(query.error),
  };
}

interface UseHostMetricsHistoryOptions extends UseHostMetricsOptions {
  maxDataPoints?: number;
}

export function useHostMetricsHistory(hostId?: string | null, options: UseHostMetricsHistoryOptions = {}) {
  const { maxDataPoints = 24, enabled = true, refetchInterval = 10000 } = options;
  const [history, setHistory] = useState<HostMetricsPoint[]>([]);
  const query = useHostMetrics(hostId, { enabled, refetchInterval });

  useEffect(() => {
    setHistory([]);
  }, [hostId]);

  useEffect(() => {
    if (!query.data) return;

    setHistory((previous) => {
      const withoutDuplicate = previous.filter((point) => point.timestamp !== query.data!.timestamp);
      return [...withoutDuplicate, query.data!]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-maxDataPoints);
    });
  }, [maxDataPoints, query.data]);

  const latestPoint = history[history.length - 1] ?? query.data;
  const failure = useMemo(() => getHostMetricsFailure(query.error), [query.error]);

  return {
    ...query,
    history,
    latestPoint,
    failure,
  };
}
