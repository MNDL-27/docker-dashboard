import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockMetricRow = {
  id: string;
  containerId: string;
  timestamp: Date;
};

const fixtures = vi.hoisted(() => ({
  containers: [] as Array<{ id: string; hostId: string; dockerId: string }>,
  createdMetricRows: [] as Array<{
    containerId: string;
    cpuUsagePercent: number;
    memoryUsageBytes: bigint;
    networkRxBytes: bigint;
    networkTxBytes: bigint;
  }>,
  storedMetrics: [] as MockMetricRow[],
}));

const prismaMock = vi.hoisted(() => ({
  container: {
    findMany: vi.fn(async ({ where }: any) => {
      const dockerIds: string[] = where?.dockerId?.in ?? [];
      return fixtures.containers
        .filter((container) => container.hostId === where?.hostId && dockerIds.includes(container.dockerId))
        .map((container) => ({ id: container.id, dockerId: container.dockerId }));
    }),
  },
  containerMetric: {
    createMany: vi.fn(async ({ data }: any) => {
      fixtures.createdMetricRows.push(...data);
      return { count: data.length };
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      const cutoff: Date = where?.timestamp?.lt;
      const beforeCount = fixtures.storedMetrics.length;
      fixtures.storedMetrics = fixtures.storedMetrics.filter((row) => row.timestamp >= cutoff);
      return { count: beforeCount - fixtures.storedMetrics.length };
    }),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

import {
  METRICS_RETENTION_HOURS,
  clampMetricsLookbackStart,
  cleanupOldMetrics,
  getMetricsRetentionCutoff,
  saveMetricsBatch,
} from '../services/metrics';

describe('metrics ingest mapping and retention boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    fixtures.containers = [];
    fixtures.createdMetricRows = [];
    fixtures.storedMetrics = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps host-scoped docker IDs to internal container UUIDs before persistence', async () => {
    fixtures.containers = [{ id: 'container-uuid-1', hostId: 'host-a', dockerId: 'docker-a' }];

    await saveMetricsBatch('host-a', [
      {
        containerId: 'docker-a',
        cpuUsagePercent: 43,
        memoryUsageBytes: 512,
        networkRxBytes: 1024,
        networkTxBytes: 2048,
      },
    ]);

    await vi.runAllTimersAsync();

    expect(prismaMock.container.findMany).toHaveBeenCalledOnce();
    expect(fixtures.createdMetricRows).toHaveLength(1);
    expect(fixtures.createdMetricRows[0]).toMatchObject({
      containerId: 'container-uuid-1',
      cpuUsagePercent: 43,
      memoryUsageBytes: 512n,
      networkRxBytes: 1024n,
      networkTxBytes: 2048n,
    });
  });

  it('ignores unknown docker IDs without writing invalid metric rows', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await saveMetricsBatch('host-a', [
      {
        containerId: 'unknown-docker-id',
        cpuUsagePercent: 10,
        memoryUsageBytes: 100,
        networkRxBytes: 200,
        networkTxBytes: 300,
      },
    ]);

    await vi.runAllTimersAsync();

    expect(prismaMock.containerMetric.createMany).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[metrics.ingest.unmatched]', {
      hostId: 'host-a',
      unmatchedCount: 1,
      totalReceived: 1,
    });
  });

  it('deletes samples older than 24h and clamps default lookback to 24h retention', async () => {
    const now = new Date('2026-03-04T12:00:00.000Z');
    vi.setSystemTime(now);

    fixtures.storedMetrics = [
      {
        id: 'old',
        containerId: 'container-1',
        timestamp: new Date(now.getTime() - (METRICS_RETENTION_HOURS * 60 * 60 * 1000 + 1000)),
      },
      {
        id: 'boundary',
        containerId: 'container-1',
        timestamp: new Date(now.getTime() - METRICS_RETENTION_HOURS * 60 * 60 * 1000 + 1000),
      },
      {
        id: 'recent',
        containerId: 'container-1',
        timestamp: new Date(now.getTime() - 5 * 60 * 1000),
      },
    ];

    await cleanupOldMetrics();

    expect(fixtures.storedMetrics.map((row) => row.id)).toEqual(['boundary', 'recent']);

    const lookbackStart = clampMetricsLookbackStart(undefined, now);
    const queriedRows = [
      { id: 'too-old', timestamp: new Date(now.getTime() - (METRICS_RETENTION_HOURS * 60 * 60 * 1000 + 5000)) },
      { id: 'in-window', timestamp: new Date(now.getTime() - 60 * 1000) },
    ].filter((row) => row.timestamp >= lookbackStart);

    expect(lookbackStart.toISOString()).toBe(getMetricsRetentionCutoff(now).toISOString());
    expect(queriedRows.map((row) => row.id)).toEqual(['in-window']);
    expect(clampMetricsLookbackStart(new Date('2020-01-01T00:00:00.000Z'), now).toISOString()).toBe(
      lookbackStart.toISOString()
    );
  });
});
