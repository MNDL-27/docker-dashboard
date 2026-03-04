import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockLogRow = {
  id: string;
  containerId: string;
  timestamp: Date;
};

const fixtures = vi.hoisted(() => ({
  containers: [] as Array<{ id: string; hostId: string; dockerId: string }>,
  createdLogRows: [] as Array<{
    containerId: string;
    stream: string;
    message: string;
    timestamp: Date;
  }>,
  storedLogs: [] as MockLogRow[],
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
  containerLog: {
    createMany: vi.fn(async ({ data }: any) => {
      fixtures.createdLogRows.push(...data);
      return { count: data.length };
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      const cutoff: Date = where?.timestamp?.lt;
      const beforeCount = fixtures.storedLogs.length;
      fixtures.storedLogs = fixtures.storedLogs.filter((row) => row.timestamp >= cutoff);
      return { count: beforeCount - fixtures.storedLogs.length };
    }),
  },
}));

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

import {
  LOG_RETENTION_HOURS,
  clampLogRangeStart,
  cleanupOldLogs,
  getLogRetentionCutoff,
  saveLogsBatch,
} from '../services/logs';

describe('logs ingest mapping and retention boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    fixtures.containers = [];
    fixtures.createdLogRows = [];
    fixtures.storedLogs = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps host-scoped docker IDs and keeps provided source timestamps', async () => {
    fixtures.containers = [{ id: 'container-uuid-1', hostId: 'host-a', dockerId: 'docker-a' }];
    const sourceTimestamp = '2026-03-04T10:15:30.000Z';

    await saveLogsBatch('host-a', [
      {
        containerId: 'docker-a',
        stream: 'stdout',
        message: 'hello from container',
        timestamp: sourceTimestamp,
      },
    ]);

    await vi.runAllTimersAsync();

    expect(prismaMock.container.findMany).toHaveBeenCalledOnce();
    expect(fixtures.createdLogRows).toHaveLength(1);
    expect(fixtures.createdLogRows[0]).toMatchObject({
      containerId: 'container-uuid-1',
      stream: 'stdout',
      message: 'hello from container',
    });
    expect(fixtures.createdLogRows[0]?.timestamp.toISOString()).toBe(sourceTimestamp);
  });

  it('drops unknown docker IDs and emits unmatched warning counters', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await saveLogsBatch('host-a', [
      {
        containerId: 'unknown-docker-id',
        stream: 'stderr',
        message: 'container not tracked',
      },
    ]);

    await vi.runAllTimersAsync();

    expect(prismaMock.containerLog.createMany).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[logs.ingest.unmatched]', {
      hostId: 'host-a',
      unmatchedCount: 1,
      totalReceived: 1,
    });
  });

  it('deletes stale logs and exposes clamp metadata for partial/full out-of-range windows', async () => {
    const now = new Date('2026-03-04T12:00:00.000Z');
    vi.setSystemTime(now);

    fixtures.storedLogs = [
      {
        id: 'old',
        containerId: 'container-1',
        timestamp: new Date(now.getTime() - (LOG_RETENTION_HOURS * 60 * 60 * 1000 + 1000)),
      },
      {
        id: 'boundary',
        containerId: 'container-1',
        timestamp: new Date(now.getTime() - LOG_RETENTION_HOURS * 60 * 60 * 1000 + 1000),
      },
      {
        id: 'recent',
        containerId: 'container-1',
        timestamp: new Date(now.getTime() - 60 * 1000),
      },
    ];

    await cleanupOldLogs();
    expect(fixtures.storedLogs.map((row) => row.id)).toEqual(['boundary', 'recent']);

    const cutoff = getLogRetentionCutoff(now);
    const defaultStart = clampLogRangeStart(undefined, now);
    expect(defaultStart.toISOString()).toBe(cutoff.toISOString());

    const partialRequestedStart = new Date('2020-01-01T00:00:00.000Z');
    const partialRequestedEnd = new Date(now.getTime() - 10 * 60 * 1000);
    const partialEffectiveStart = clampLogRangeStart(partialRequestedStart, now);
    const partialOutOfRange = partialRequestedStart < partialEffectiveStart && partialRequestedEnd >= partialEffectiveStart;
    expect(partialOutOfRange).toBe(true);

    const fullRequestedStart = new Date('2020-01-01T00:00:00.000Z');
    const fullRequestedEnd = new Date(now.getTime() - (LOG_RETENTION_HOURS * 60 * 60 * 1000 + 60 * 1000));
    const fullEffectiveStart = clampLogRangeStart(fullRequestedStart, now);
    const fullyOutOfRange = fullRequestedEnd < fullEffectiveStart;
    expect(fullyOutOfRange).toBe(true);

    const queriedRows = [
      { id: 'too-old', timestamp: new Date(now.getTime() - (LOG_RETENTION_HOURS * 60 * 60 * 1000 + 5000)) },
      { id: 'in-window', timestamp: new Date(now.getTime() - 30 * 1000) },
    ].filter((row) => row.timestamp >= partialEffectiveStart);

    expect(queriedRows.map((row) => row.id)).toEqual(['in-window']);
  });
});
