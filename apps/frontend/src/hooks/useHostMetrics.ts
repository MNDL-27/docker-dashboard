import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dockerApi } from "@/services/docker-api";
import { apiFetch } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { FAST_POLL_INTERVAL_MS, DEFAULT_MAX_DATA_POINTS } from "@/lib/constants";
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

interface CachedMetricsResponse {
  hostId: string;
  metrics: (HostMetricsApiPoint & { collectedAt: string })[];
  latest: (HostMetricsApiPoint & { collectedAt: string }) | null;
  stale: boolean;
  collectedAt: string | null;
}

async function fetchCachedMetrics(hostId: string): Promise<CachedMetricsResponse> {
  return apiFetch(`/host-metrics-cached?hostId=${hostId}&limit=24`);
}

async function fetchRealTimeMetrics(hostId: string): Promise<HostMetricsPoint> {
  const data = await dockerApi.hostMetrics(hostId);
  const normalized = transformApiMetrics((data ?? {}) as HostMetricsApiPoint);
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
}

export function useHostMetrics(hostId?: string | null, options: UseHostMetricsOptions = {}) {
  const { enabled = true, refetchInterval = FAST_POLL_INTERVAL_MS } = options;

  const query = useQuery({
    queryKey: ["host-metrics", hostId],
    queryFn: async (): Promise<HostMetricsPoint> => {
      if (!hostId) throw new Error("hostId required");

      // Try cached metrics first (background collector runs every minute)
      try {
        const cached = await fetchCachedMetrics(hostId);
        if (cached.latest && !cached.stale) {
          return transformApiMetrics(cached.latest as HostMetricsApiPoint);
        }
      } catch (_) {
        // Fall through to real-time proxy
      }

      // Fall back to real-time proxy when cache is stale or unavailable
      return fetchRealTimeMetrics(hostId);
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
  const { maxDataPoints = DEFAULT_MAX_DATA_POINTS, enabled = true, refetchInterval = FAST_POLL_INTERVAL_MS } = options;
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
