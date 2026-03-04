import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function buildExportPayload(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-1',
    projectId: 'proj-1',
    hostId: 'host-1',
    containerId: 'container-1',
    format: 'log',
    range: {
      type: 'preset',
      preset: '1h',
    },
    ...overrides,
  };
}

function buildRangeResult(lines: Array<{ stream?: string; message: string; timestamp?: string }>) {
  return {
    scope: {
      organizationId: 'org-1',
      projectId: 'proj-1',
      hostId: 'host-1',
      containerId: 'container-1',
    },
    lines: lines.map((line, index) => ({
      containerId: 'container-1',
      stream: line.stream ?? 'stdout',
      message: line.message,
      timestamp: line.timestamp ?? `2026-03-05T10:00:${String(index % 60).padStart(2, '0')}.000Z`,
    })),
    metadata: {
      requestedRange: {
        start: '2026-03-04T09:00:00.000Z',
        end: '2026-03-05T10:00:00.000Z',
      },
      deliveredRange: {
        start: '2026-03-05T10:00:01.000Z',
        end: '2026-03-05T10:10:00.000Z',
      },
      trimmed: {
        start: true,
        end: false,
        any: true,
      },
      retentionCutoff: '2026-03-04T10:00:00.000Z',
    },
  };
}

describe('logs export route contract', () => {
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
    logsServiceMock.getLogsRange.mockResolvedValue(
      buildRangeResult([
        { message: 'hello world' },
        { message: 'line two' },
      ])
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects invalid export format values', async () => {
    const response = await request(app)
      .post('/api/logs/export')
      .send(buildExportPayload({ format: 'json' }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid logs export payload');
  });

  it('rejects invalid custom range when start is after end', async () => {
    const response = await request(app)
      .post('/api/logs/export')
      .send(
        buildExportPayload({
          range: {
            type: 'custom',
            start: '2026-03-05T11:00:00.000Z',
            end: '2026-03-05T10:00:00.000Z',
          },
        })
      );

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid logs export range');
  });

  it('returns direct export payload for small exports with retention metadata', async () => {
    const response = await request(app)
      .post('/api/logs/export')
      .send(buildExportPayload({ format: 'ndjson' }));

    expect(response.status).toBe(200);
    expect(response.body.delivery).toBe('direct');
    expect(response.body.download.format).toBe('ndjson');
    expect(response.body.download.fileName).toContain('.ndjson');
    expect(response.body.retention).toMatchObject({
      requestedRange: {
        start: '2026-03-04T09:00:00.000Z',
      },
      deliveredRange: {
        end: '2026-03-05T10:10:00.000Z',
      },
      trimmed: {
        any: true,
      },
    });
  });

  it('queues background export for large payloads and exposes ready status by id', async () => {
    vi.useFakeTimers();

    logsServiceMock.getLogsRange.mockResolvedValueOnce(
      buildRangeResult(
        Array.from({ length: 5_000 }, (_, index) => ({
          message: `very-long-line-${index.toString().padStart(4, '0')}-${'x'.repeat(80)}`,
        }))
      )
    );

    const createResponse = await request(app)
      .post('/api/logs/export')
      .send(buildExportPayload({ format: 'log' }));

    expect(createResponse.status).toBe(202);
    expect(createResponse.body.delivery).toBe('background');
    expect(createResponse.body.job.status).toBe('queued');
    expect(createResponse.body.retention.trimmed.any).toBe(true);

    const jobId = createResponse.body.job.id as string;

    const queuedResponse = await request(app).get(`/api/logs/exports/${jobId}`);
    expect(queuedResponse.status).toBe(200);
    expect(['queued', 'running', 'ready']).toContain(queuedResponse.body.status);

    await vi.runAllTimersAsync();

    const readyResponse = await request(app).get(`/api/logs/exports/${jobId}`);
    expect(readyResponse.status).toBe(200);
    expect(readyResponse.body.status).toBe('ready');
    expect(readyResponse.body.download.fileName).toContain('.log');
    expect(readyResponse.body.download.lineCount).toBe(5000);
    expect(readyResponse.body.retention).toMatchObject({
      requestedRange: {
        start: '2026-03-04T09:00:00.000Z',
      },
      trimmed: {
        any: true,
      },
    });
  });
});
