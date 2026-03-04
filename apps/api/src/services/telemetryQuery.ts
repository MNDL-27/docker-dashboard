import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { clampMetricsLookbackStart } from './metrics';
import { resolveUserScope, scopedContainerWhere, scopedHostWhere } from './scopedAccess';

export const TELEMETRY_WINDOWS = ['15m', '1h', '6h', '24h'] as const;
export type TelemetryWindow = (typeof TELEMETRY_WINDOWS)[number];
export const TELEMETRY_SPEED_PRESETS = ['1x', '2x', '4x'] as const;
export type TelemetrySpeedPreset = (typeof TELEMETRY_SPEED_PRESETS)[number];

export interface TelemetryScope {
  organizationId: string;
  projectId?: string;
  hostId?: string;
  containerId?: string;
}

export interface TelemetryFrameAggregate {
  containerCount: number;
  cpuUsagePercentAvg: number;
  memoryUsageBytesAvg: number;
  networkRxBytesMax: number;
  networkTxBytesMax: number;
  restartIndicators: {
    restartingNow: number;
    containersWithRestarts: number;
  };
}

export interface TelemetryContributor {
  containerId: string;
  dockerId: string;
  hostId: string;
  name: string;
  cpuUsagePercent: number;
  memoryUsageBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  restartCount: number;
  state: string;
}

export interface TelemetryTrendPoint {
  timestamp: string;
  cpuUsagePercentAvg: number;
  memoryUsageBytesAvg: number;
  networkRxBytesMax: number;
  networkTxBytesMax: number;
}

export interface TelemetryFrame {
  aggregate: TelemetryFrameAggregate;
  topContributors: TelemetryContributor[];
  trend: TelemetryTrendPoint[];
}

export interface TelemetryHistoryResult extends TelemetryFrame {
  scope: TelemetryScope;
  window: TelemetryWindow;
  lookbackStart: string;
}

interface WindowConfig {
  lookbackMs: number;
  bucketSeconds: number;
}

const WINDOW_CONFIG: Record<TelemetryWindow, WindowConfig> = {
  '15m': { lookbackMs: 15 * 60 * 1000, bucketSeconds: 60 },
  '1h': { lookbackMs: 60 * 60 * 1000, bucketSeconds: 5 * 60 },
  '6h': { lookbackMs: 6 * 60 * 60 * 1000, bucketSeconds: 15 * 60 },
  '24h': { lookbackMs: 24 * 60 * 60 * 1000, bucketSeconds: 60 * 60 },
};

function clampTopN(topN: number | undefined): number {
  if (!Number.isFinite(topN) || !topN) {
    return 5;
  }

  if (topN < 1) {
    return 1;
  }

  if (topN > 25) {
    return 25;
  }

  return Math.floor(topN);
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'number') {
    return value;
  }

  return 0;
}

export async function resolveTelemetryScopeForUser(input: {
  userId: string;
  organizationId: string;
  projectId?: string;
  hostId?: string;
  containerId?: string;
}): Promise<TelemetryScope | null> {
  const scope = await resolveUserScope({
    userId: input.userId,
    organizationId: input.organizationId,
    projectId: input.projectId,
  });

  if (!scope) {
    return null;
  }

  if (input.hostId) {
    const host = await prisma.host.findFirst({
      where: scopedHostWhere(scope, { id: input.hostId }),
      select: { id: true },
    });

    if (!host) {
      return null;
    }
  }

  if (input.containerId) {
    const container = await prisma.container.findFirst({
      where: scopedContainerWhere(scope, {
        id: input.containerId,
        ...(input.hostId ? { hostId: input.hostId } : {}),
      }),
      select: { id: true },
    });

    if (!container) {
      return null;
    }
  }

  return {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    hostId: input.hostId,
    containerId: input.containerId,
  };
}

export async function getTelemetryHistory(input: {
  scope: TelemetryScope;
  window: TelemetryWindow;
  topN?: number;
  now?: Date;
}): Promise<TelemetryHistoryResult> {
  const now = input.now ?? new Date();
  const topN = clampTopN(input.topN);
  const windowConfig = WINDOW_CONFIG[input.window];
  const lookbackStart = clampMetricsLookbackStart(new Date(now.getTime() - windowConfig.lookbackMs), now);

  const containers = await prisma.container.findMany({
    where: scopedContainerWhere(input.scope, {
      ...(input.scope.hostId ? { hostId: input.scope.hostId } : {}),
      ...(input.scope.containerId ? { id: input.scope.containerId } : {}),
    }),
    select: {
      id: true,
      dockerId: true,
      hostId: true,
      name: true,
      state: true,
      restartCount: true,
      metrics: {
        where: {
          timestamp: {
            gte: lookbackStart,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 1,
        select: {
          cpuUsagePercent: true,
          memoryUsageBytes: true,
          networkRxBytes: true,
          networkTxBytes: true,
        },
      },
    },
  });

  if (containers.length === 0) {
    return {
      scope: input.scope,
      window: input.window,
      lookbackStart: lookbackStart.toISOString(),
      aggregate: {
        containerCount: 0,
        cpuUsagePercentAvg: 0,
        memoryUsageBytesAvg: 0,
        networkRxBytesMax: 0,
        networkTxBytesMax: 0,
        restartIndicators: {
          restartingNow: 0,
          containersWithRestarts: 0,
        },
      },
      topContributors: [],
      trend: [],
    };
  }

  const contributors = containers
    .map((container): TelemetryContributor | null => {
      const [latestMetric] = container.metrics;
      if (!latestMetric) {
        return null;
      }

      return {
        containerId: container.id,
        dockerId: container.dockerId,
        hostId: container.hostId,
        name: container.name,
        cpuUsagePercent: latestMetric.cpuUsagePercent,
        memoryUsageBytes: toNumber(latestMetric.memoryUsageBytes),
        networkRxBytes: toNumber(latestMetric.networkRxBytes),
        networkTxBytes: toNumber(latestMetric.networkTxBytes),
        restartCount: container.restartCount,
        state: container.state,
      };
    })
    .filter((item): item is TelemetryContributor => Boolean(item));

  const rankedContributors = contributors
    .sort((a, b) => {
      if (b.cpuUsagePercent !== a.cpuUsagePercent) {
        return b.cpuUsagePercent - a.cpuUsagePercent;
      }

      return b.memoryUsageBytes - a.memoryUsageBytes;
    })
    .slice(0, topN);

  const aggregate = contributors.reduce<TelemetryFrameAggregate>(
    (acc, item) => {
      acc.containerCount += 1;
      acc.cpuUsagePercentAvg += item.cpuUsagePercent;
      acc.memoryUsageBytesAvg += item.memoryUsageBytes;
      acc.networkRxBytesMax = Math.max(acc.networkRxBytesMax, item.networkRxBytes);
      acc.networkTxBytesMax = Math.max(acc.networkTxBytesMax, item.networkTxBytes);

      if (item.state.toLowerCase() === 'restarting') {
        acc.restartIndicators.restartingNow += 1;
      }

      if (item.restartCount > 0) {
        acc.restartIndicators.containersWithRestarts += 1;
      }

      return acc;
    },
    {
      containerCount: 0,
      cpuUsagePercentAvg: 0,
      memoryUsageBytesAvg: 0,
      networkRxBytesMax: 0,
      networkTxBytesMax: 0,
      restartIndicators: {
        restartingNow: 0,
        containersWithRestarts: 0,
      },
    }
  );

  if (aggregate.containerCount > 0) {
    aggregate.cpuUsagePercentAvg = Number((aggregate.cpuUsagePercentAvg / aggregate.containerCount).toFixed(2));
    aggregate.memoryUsageBytesAvg = Math.round(aggregate.memoryUsageBytesAvg / aggregate.containerCount);
  }

  const trend = await queryTelemetryTrend({
    containerIds: containers.map((container) => container.id),
    lookbackStart,
    bucketSeconds: windowConfig.bucketSeconds,
  });

  return {
    scope: input.scope,
    window: input.window,
    lookbackStart: lookbackStart.toISOString(),
    aggregate,
    topContributors: rankedContributors,
    trend,
  };
}

async function queryTelemetryTrend(input: {
  containerIds: string[];
  lookbackStart: Date;
  bucketSeconds: number;
}): Promise<TelemetryTrendPoint[]> {
  if (input.containerIds.length === 0) {
    return [];
  }

  const rows = await prisma.$queryRaw<Array<{
    bucket: Date;
    cpu_avg: number | null;
    memory_avg: number | null;
    network_rx_max: bigint | number | null;
    network_tx_max: bigint | number | null;
  }>>(Prisma.sql`
    SELECT
      date_bin(
        make_interval(secs => ${input.bucketSeconds}),
        "timestamp",
        TIMESTAMPTZ '1970-01-01T00:00:00.000Z'
      ) AS bucket,
      avg("cpuUsagePercent")::double precision AS cpu_avg,
      avg("memoryUsageBytes")::double precision AS memory_avg,
      max("networkRxBytes") AS network_rx_max,
      max("networkTxBytes") AS network_tx_max
    FROM "ContainerMetric"
    WHERE "containerId" IN (${Prisma.join(input.containerIds)})
      AND "timestamp" >= ${input.lookbackStart}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  return rows.map((row) => ({
    timestamp: row.bucket.toISOString(),
    cpuUsagePercentAvg: Number((row.cpu_avg ?? 0).toFixed(2)),
    memoryUsageBytesAvg: Math.round(row.memory_avg ?? 0),
    networkRxBytesMax: toNumber(row.network_rx_max),
    networkTxBytesMax: toNumber(row.network_tx_max),
  }));
}

export interface LiveMetricSample {
  containerId: string;
  cpuUsagePercent: number;
  memoryUsageBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export async function buildTelemetryFrameFromLiveMetrics(input: {
  scope: TelemetryScope;
  hostId: string;
  metrics: LiveMetricSample[];
  topN?: number;
}): Promise<TelemetryFrame | null> {
  if (input.metrics.length === 0) {
    return null;
  }

  const host = await prisma.host.findFirst({
    where: scopedHostWhere(input.scope, { id: input.hostId }),
    select: { id: true },
  });

  if (!host) {
    return null;
  }

  const topN = clampTopN(input.topN);
  const dockerIds = [...new Set(input.metrics.map((metric) => metric.containerId))];

  const containers = await prisma.container.findMany({
    where: scopedContainerWhere(input.scope, {
      hostId: input.hostId,
      dockerId: { in: dockerIds },
      ...(input.scope.containerId ? { id: input.scope.containerId } : {}),
    }),
    select: {
      id: true,
      dockerId: true,
      hostId: true,
      name: true,
      state: true,
      restartCount: true,
    },
  });

  if (containers.length === 0) {
    return {
      aggregate: {
        containerCount: 0,
        cpuUsagePercentAvg: 0,
        memoryUsageBytesAvg: 0,
        networkRxBytesMax: 0,
        networkTxBytesMax: 0,
        restartIndicators: {
          restartingNow: 0,
          containersWithRestarts: 0,
        },
      },
      topContributors: [],
      trend: [],
    };
  }

  const containerByDockerId = new Map(containers.map((container) => [container.dockerId, container]));
  const contributors: TelemetryContributor[] = [];

  for (const metric of input.metrics) {
    const container = containerByDockerId.get(metric.containerId);
    if (!container) {
      continue;
    }

    contributors.push({
      containerId: container.id,
      dockerId: container.dockerId,
      hostId: container.hostId,
      name: container.name,
      cpuUsagePercent: metric.cpuUsagePercent,
      memoryUsageBytes: metric.memoryUsageBytes,
      networkRxBytes: metric.networkRxBytes,
      networkTxBytes: metric.networkTxBytes,
      restartCount: container.restartCount,
      state: container.state,
    });
  }

  const aggregate = contributors.reduce<TelemetryFrameAggregate>(
    (acc, item) => {
      acc.containerCount += 1;
      acc.cpuUsagePercentAvg += item.cpuUsagePercent;
      acc.memoryUsageBytesAvg += item.memoryUsageBytes;
      acc.networkRxBytesMax = Math.max(acc.networkRxBytesMax, item.networkRxBytes);
      acc.networkTxBytesMax = Math.max(acc.networkTxBytesMax, item.networkTxBytes);

      if (item.state.toLowerCase() === 'restarting') {
        acc.restartIndicators.restartingNow += 1;
      }

      if (item.restartCount > 0) {
        acc.restartIndicators.containersWithRestarts += 1;
      }

      return acc;
    },
    {
      containerCount: 0,
      cpuUsagePercentAvg: 0,
      memoryUsageBytesAvg: 0,
      networkRxBytesMax: 0,
      networkTxBytesMax: 0,
      restartIndicators: {
        restartingNow: 0,
        containersWithRestarts: 0,
      },
    }
  );

  if (aggregate.containerCount > 0) {
    aggregate.cpuUsagePercentAvg = Number((aggregate.cpuUsagePercentAvg / aggregate.containerCount).toFixed(2));
    aggregate.memoryUsageBytesAvg = Math.round(aggregate.memoryUsageBytesAvg / aggregate.containerCount);
  }

  const topContributors = contributors
    .sort((a, b) => {
      if (b.cpuUsagePercent !== a.cpuUsagePercent) {
        return b.cpuUsagePercent - a.cpuUsagePercent;
      }

      return b.memoryUsageBytes - a.memoryUsageBytes;
    })
    .slice(0, topN);

  return {
    aggregate,
    topContributors,
    trend: [],
  };
}
