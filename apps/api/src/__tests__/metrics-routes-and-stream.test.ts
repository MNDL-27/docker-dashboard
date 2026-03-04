import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const telemetryServiceMock = vi.hoisted(() => ({
  TELEMETRY_WINDOWS: ['15m', '1h', '6h', '24h'] as const,
  TELEMETRY_SPEED_PRESETS: ['1x', '2x', '4x'] as const,
  resolveTelemetryScopeForUser: vi.fn(),
  getTelemetryHistory: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    host: { findFirst: vi.fn() },
    container: { findFirst: vi.fn(), findMany: vi.fn() },
    organizationMember: { findUnique: vi.fn() },
    project: { findFirst: vi.fn() },
  },
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', email: 'ops@example.com', name: 'Ops' };
    next();
  },
}));

vi.mock('../services/telemetryQuery', () => telemetryServiceMock);

import metricsRoutes from '../routes/metrics';
import { applyTelemetryControl, shouldEmitTelemetryFrame, type TelemetryClientState } from '../websocket/server';

describe('metrics routes and stream contract', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/metrics', metricsRoutes);

  beforeEach(() => {
    vi.clearAllMocks();

    telemetryServiceMock.resolveTelemetryScopeForUser.mockResolvedValue({
      organizationId: 'org-1',
      projectId: 'proj-1',
      hostId: 'host-1',
    });

    telemetryServiceMock.getTelemetryHistory.mockResolvedValue({
      scope: {
        organizationId: 'org-1',
        projectId: 'proj-1',
        hostId: 'host-1',
      },
      window: '1h',
      lookbackStart: '2026-03-04T10:00:00.000Z',
      aggregate: {
        containerCount: 2,
        cpuUsagePercentAvg: 35.5,
        memoryUsageBytesAvg: 4096,
        networkRxBytesMax: 1000,
        networkTxBytesMax: 2500,
        restartIndicators: {
          restartingNow: 1,
          containersWithRestarts: 1,
        },
      },
      topContributors: [
        {
          containerId: 'container-1',
          dockerId: 'docker-1',
          hostId: 'host-1',
          name: 'api',
          cpuUsagePercent: 70,
          memoryUsageBytes: 8192,
          networkRxBytes: 1000,
          networkTxBytes: 2500,
          restartCount: 2,
          state: 'restarting',
        },
      ],
      trend: [
        {
          timestamp: '2026-03-04T10:00:00.000Z',
          cpuUsagePercentAvg: 30,
          memoryUsageBytesAvg: 4000,
          networkRxBytesMax: 800,
          networkTxBytesMax: 1800,
        },
      ],
    });
  });

  it('rejects invalid history window presets', async () => {
    const response = await request(app)
      .get('/api/metrics')
      .query({ organizationId: 'org-1', projectId: 'proj-1', window: '7d' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid metrics query');
  });

  it('returns scoped telemetry history for allowed windows with KPI payload shape', async () => {
    const response = await request(app)
      .get('/api/metrics')
      .query({ organizationId: 'org-1', projectId: 'proj-1', hostId: 'host-1', window: '15m', topN: '3' });

    expect(response.status).toBe(200);
    expect(telemetryServiceMock.resolveTelemetryScopeForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      hostId: 'host-1',
      containerId: undefined,
    });
    expect(telemetryServiceMock.getTelemetryHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        window: '15m',
        topN: 3,
      })
    );
    expect(response.body.aggregate).toMatchObject({
      cpuUsagePercentAvg: 35.5,
      restartIndicators: {
        restartingNow: 1,
      },
    });
    expect(response.body.topContributors[0]).toMatchObject({
      name: 'api',
      restartCount: 2,
    });
  });

  it('denies out-of-scope telemetry requests', async () => {
    telemetryServiceMock.resolveTelemetryScopeForUser.mockResolvedValueOnce(null);

    const response = await request(app)
      .get('/api/metrics')
      .query({ organizationId: 'org-2', projectId: 'proj-2', window: '1h' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('out of bounds');
  });

  it('keeps 24h window requests bounded and omits deferred contracts from live snapshot', async () => {
    telemetryServiceMock.getTelemetryHistory.mockResolvedValueOnce({
      scope: {
        organizationId: 'org-1',
        projectId: 'proj-1',
      },
      window: '24h',
      lookbackStart: '2026-03-03T10:00:00.000Z',
      aggregate: {
        containerCount: 4,
        cpuUsagePercentAvg: 20,
        memoryUsageBytesAvg: 5000,
        networkRxBytesMax: 900,
        networkTxBytesMax: 1500,
        restartIndicators: {
          restartingNow: 0,
          containersWithRestarts: 2,
        },
      },
      topContributors: [],
      trend: [],
    });

    const response = await request(app)
      .get('/api/metrics/live')
      .query({ organizationId: 'org-1', projectId: 'proj-1', window: '24h' });

    expect(response.status).toBe(200);
    expect(telemetryServiceMock.getTelemetryHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        window: '24h',
      })
    );
    expect(response.body.window).toBe('24h');
    expect(response.body.aggregate).toMatchObject({ containerCount: 4 });
    expect(response.body).not.toHaveProperty('logs');
    expect(response.body).not.toHaveProperty('actions');
    expect(response.body).not.toHaveProperty('alerts');
  });
});

describe('telemetry stream controls', () => {
  const baseState: TelemetryClientState = {
    userId: 'user-1',
    scope: { organizationId: 'org-1' },
    paused: false,
    speed: '1x',
    topN: 5,
    lastFrameAt: 1_000,
  };

  it('applies pause/resume controls and speed preset changes deterministically', () => {
    const pausedState = applyTelemetryControl(baseState, {
      type: 'metrics.control',
      action: 'pause',
    });
    expect(pausedState.paused).toBe(true);

    const resumedState = applyTelemetryControl(pausedState, {
      type: 'metrics.control',
      action: 'resume',
    });
    expect(resumedState.paused).toBe(false);

    const fastState = applyTelemetryControl(resumedState, {
      type: 'metrics.control',
      action: 'set-speed',
      speed: '4x',
    });
    expect(fastState.speed).toBe('4x');
  });

  it('throttles fan-out by speed preset without changing ingest behavior', () => {
    const normal = { ...baseState, speed: '1x' as const };
    const fast = { ...baseState, speed: '4x' as const };

    expect(shouldEmitTelemetryFrame(normal, 1_400)).toBe(false);
    expect(shouldEmitTelemetryFrame(normal, 2_001)).toBe(true);
    expect(shouldEmitTelemetryFrame(fast, 1_200)).toBe(false);
    expect(shouldEmitTelemetryFrame(fast, 1_251)).toBe(true);
  });
});
