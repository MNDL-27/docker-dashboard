import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const scopedAccessMock = vi.hoisted(() => ({
  resolveUserScope: vi.fn(),
  scopedContainerWhere: vi.fn(),
}));

const logsServiceMock = vi.hoisted(() => ({
  getLogsRange: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  container: {
    findFirst: vi.fn(),
  },
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', email: 'ops@example.com', name: 'Ops' };
    next();
  },
}));

vi.mock('../services/scopedAccess', () => scopedAccessMock);
vi.mock('../services/logs', async () => {
  const actual = await vi.importActual('../services/logs');
  return {
    ...actual,
    getLogsRange: logsServiceMock.getLogsRange,
  };
});
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }));

import logsRouter from '../routes/logs';
import {
  applyLogsControl,
  buildLogsControlAck,
  buildLogsSubscribeAck,
  formatPendingBadge,
  queuePausedLogs,
  shouldDeliverLogLineToState,
  type LogsClientState,
} from '../websocket/server';

describe('logs route and stream contract', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/logs', logsRouter);

  beforeEach(() => {
    vi.clearAllMocks();

    scopedAccessMock.resolveUserScope.mockResolvedValue({
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      role: 'ADMIN',
    });
    scopedAccessMock.scopedContainerWhere.mockImplementation((_scope: unknown, extra: Record<string, unknown>) => extra);
    prismaMock.container.findFirst.mockResolvedValue({ id: 'container-1' });
    logsServiceMock.getLogsRange.mockResolvedValue({
      scope: {
        organizationId: 'org-1',
        projectId: 'proj-1',
        hostId: 'host-1',
        containerId: 'container-1',
      },
      lines: [
        {
          containerId: 'container-1',
          stream: 'stdout',
          message: 'line-1',
          timestamp: '2026-03-05T10:00:01.000Z',
        },
      ],
      metadata: {
        requestedRange: {
          start: '2026-03-04T09:00:00.000Z',
          end: '2026-03-05T10:00:00.000Z',
        },
        deliveredRange: {
          start: '2026-03-05T10:00:01.000Z',
          end: '2026-03-05T10:00:01.000Z',
        },
        trimmed: {
          start: true,
          end: false,
          any: true,
        },
        retentionCutoff: '2026-03-04T10:00:00.000Z',
      },
    });
  });

  it('returns scoped container lines with retention requested/delivered trim metadata', async () => {
    const response = await request(app).get('/api/logs').query({
      organizationId: 'org-1',
      projectId: 'proj-1',
      hostId: 'host-1',
      containerId: 'container-1',
      start: '2026-03-04T09:00:00.000Z',
      end: '2026-03-05T10:00:00.000Z',
      limit: '100',
    });

    expect(response.status).toBe(200);
    expect(scopedAccessMock.resolveUserScope).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
    });
    expect(response.body.retention).toMatchObject({
      requestedRange: {
        start: '2026-03-04T09:00:00.000Z',
        end: '2026-03-05T10:00:00.000Z',
      },
      deliveredRange: {
        start: '2026-03-05T10:00:01.000Z',
      },
      trimmed: {
        any: true,
      },
    });
    expect(response.body.lines).toHaveLength(1);
  });

  it('denies logs requests when user scope is out of bounds', async () => {
    scopedAccessMock.resolveUserScope.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/logs').query({
      organizationId: 'org-2',
      hostId: 'host-2',
      containerId: 'container-2',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('out of bounds');
  });

  it('denies logs requests when container is not in scoped host/project', async () => {
    prismaMock.container.findFirst.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/logs').query({
      organizationId: 'org-1',
      projectId: 'proj-1',
      hostId: 'host-1',
      containerId: 'container-denied',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('out of bounds');
  });

  it('rejects invalid range where start is after end', async () => {
    const response = await request(app).get('/api/logs').query({
      organizationId: 'org-1',
      hostId: 'host-1',
      containerId: 'container-1',
      start: '2026-03-05T10:00:00.000Z',
      end: '2026-03-05T09:00:00.000Z',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('start must be before end');
  });

  it('keeps deferred capabilities out of logs route contract payload', async () => {
    const response = await request(app).get('/api/logs').query({
      organizationId: 'org-1',
      hostId: 'host-1',
      containerId: 'container-1',
    });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('search');
    expect(response.body).not.toHaveProperty('alerts');
    expect(response.body).not.toHaveProperty('actions');
  });
});

describe('logs websocket contract helpers', () => {
  const baseState: LogsClientState = {
    userId: 'user-1',
    scope: {
      organizationId: 'org-1',
      projectId: 'proj-1',
      hostId: 'host-1',
      containerId: 'container-1',
    },
    paused: false,
    reconnectMode: 'backfill',
    status: 'Connected',
    pendingCount: 0,
    pendingBadge: '0',
    pendingLines: [],
  };

  it('builds subscribe/control acknowledgements with expected log-only fields', () => {
    const subscribeAck = buildLogsSubscribeAck(baseState);
    const controlAck = buildLogsControlAck(baseState);

    expect(subscribeAck.type).toBe('logs.subscribe.ack');
    expect(controlAck.type).toBe('logs.control.ack');
    expect(subscribeAck).not.toHaveProperty('alerts');
    expect(controlAck).not.toHaveProperty('actions');
    expect(controlAck).not.toHaveProperty('search');
  });

  it('applies pause/resume and reconnect mode controls deterministically', () => {
    const pausedState = applyLogsControl(baseState, {
      type: 'logs.control',
      action: 'pause',
    });
    expect(pausedState.paused).toBe(true);
    expect(pausedState.status).toBe('Paused');

    const nowModeState = applyLogsControl(pausedState, {
      type: 'logs.control',
      action: 'set-mode',
      mode: 'now',
    });
    expect(nowModeState.reconnectMode).toBe('now');

    const resumedState = applyLogsControl(nowModeState, {
      type: 'logs.control',
      action: 'resume',
    });
    expect(resumedState.paused).toBe(false);
    expect(resumedState.status).toBe('Connected');
    expect(resumedState.pendingCount).toBe(0);
  });

  it('caps paused pending counter badge at 999+', () => {
    const burst = Array.from({ length: 1200 }, (_, index) => ({
      containerId: 'container-1',
      hostId: 'host-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      stream: 'stdout',
      message: `line-${index}`,
      timestamp: `2026-03-05T10:00:${String(index % 60).padStart(2, '0')}.000Z`,
    }));

    const queued = queuePausedLogs(baseState, burst);

    expect(queued.pendingCount).toBe(1200);
    expect(queued.pendingBadge).toBe('999+');
    expect(formatPendingBadge(1000)).toBe('999+');
  });

  it('filters fan-out delivery to the subscribed tenant/container only', () => {
    const inScope = {
      containerId: 'container-1',
      hostId: 'host-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      stream: 'stdout',
      message: 'ok',
      timestamp: '2026-03-05T10:00:00.000Z',
    };
    const outOfScope = {
      ...inScope,
      organizationId: 'org-2',
    };

    expect(shouldDeliverLogLineToState(baseState, inScope)).toBe(true);
    expect(shouldDeliverLogLineToState(baseState, outOfScope)).toBe(false);
  });
});
