import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getLogsRange } from '../services/logs';
import { resolveUserScope, scopedContainerWhere } from '../services/scopedAccess';

const logsRouter = Router();

const logsReadQuerySchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  hostId: z.string().min(1),
  containerId: z.string().min(1),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

const LOG_EXPORT_PRESETS = ['15m', '1h', '6h', '24h'] as const;
const LOG_EXPORT_FORMATS = ['log', 'ndjson'] as const;

const logsExportBodySchema = z
  .object({
    organizationId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    hostId: z.string().min(1),
    containerId: z.string().min(1),
    format: z.enum(LOG_EXPORT_FORMATS),
    range: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('preset'),
        preset: z.enum(LOG_EXPORT_PRESETS),
      }),
      z.object({
        type: z.literal('custom'),
        start: z.string().min(1),
        end: z.string().min(1),
      }),
    ]),
  })
  .strict();

const logsExportJobParamsSchema = z.object({
  id: z.string().min(1),
});

const EXPORT_BACKGROUND_THRESHOLD_BYTES = 250 * 1024;
const EXPORT_BACKGROUND_THRESHOLD_LINES = 4_000;
const EXPORT_JOB_TTL_MS = 15 * 60 * 1000;

type LogsExportStatus = 'queued' | 'running' | 'ready' | 'failed' | 'expired';

interface LogsExportJob {
  id: string;
  ownerUserId: string;
  status: LogsExportStatus;
  createdAt: Date;
  updatedAt: Date;
  download: {
    fileName: string;
    format: (typeof LOG_EXPORT_FORMATS)[number];
    contentType: string;
    data: string;
    lineCount: number;
    sizeBytes: number;
  } | null;
  retention: Awaited<ReturnType<typeof getLogsRange>>['metadata'];
  error: string | null;
}

const exportJobs = new Map<string, LogsExportJob>();

function getContentType(format: (typeof LOG_EXPORT_FORMATS)[number]): string {
  if (format === 'ndjson') {
    return 'application/x-ndjson; charset=utf-8';
  }

  return 'text/plain; charset=utf-8';
}

function formatExportLine(
  line: {
    timestamp: string;
    stream: string;
    message: string;
  },
  format: (typeof LOG_EXPORT_FORMATS)[number]
): string {
  if (format === 'ndjson') {
    return JSON.stringify(line);
  }

  return `${line.timestamp} [${line.stream}] ${line.message}`;
}

function parseCustomRange(range: { start: string; end: string }): { start: Date; end: Date } | null {
  const start = new Date(range.start);
  const end = new Date(range.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (start > end) {
    return null;
  }

  return { start, end };
}

function resolveExportRange(range: z.infer<typeof logsExportBodySchema>['range'], now: Date): { start: Date; end: Date } | null {
  if (range.type === 'custom') {
    return parseCustomRange(range);
  }

  const presetMinutes: Record<(typeof LOG_EXPORT_PRESETS)[number], number> = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 24 * 60,
  };

  const minutes = presetMinutes[range.preset];
  return {
    start: new Date(now.getTime() - minutes * 60 * 1000),
    end: now,
  };
}

function buildExportFileName(input: {
  projectId?: string;
  hostId: string;
  containerId: string;
  start: Date;
  end: Date;
  format: (typeof LOG_EXPORT_FORMATS)[number];
}): string {
  const safeProject = (input.projectId ?? 'project').replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeHost = input.hostId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeContainer = input.containerId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const startUtc = input.start.toISOString().replace(/[:.]/g, '-');
  const endUtc = input.end.toISOString().replace(/[:.]/g, '-');
  const extension = input.format === 'ndjson' ? 'ndjson' : 'log';

  return `${safeProject}_${safeHost}_${safeContainer}_${startUtc}_to_${endUtc}.${extension}`;
}

function isJobExpired(job: LogsExportJob, now: Date = new Date()): boolean {
  return now.getTime() - job.createdAt.getTime() > EXPORT_JOB_TTL_MS;
}

logsRouter.use(requireAuth);

logsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = logsReadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid logs query parameters',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { organizationId, projectId, hostId, containerId, start, end, limit } = parsed.data;

    const requestedStart = start ? new Date(start) : undefined;
    const requestedEnd = end ? new Date(end) : undefined;
    if ((requestedStart && Number.isNaN(requestedStart.getTime())) || (requestedEnd && Number.isNaN(requestedEnd.getTime()))) {
      res.status(400).json({ error: 'Invalid logs query range. Use ISO timestamps for start/end.' });
      return;
    }

    if (requestedStart && requestedEnd && requestedStart > requestedEnd) {
      res.status(400).json({ error: 'Invalid logs query range. start must be before end.' });
      return;
    }

    const scope = await resolveUserScope({
      userId: req.user!.id,
      organizationId,
      projectId,
    });

    if (!scope) {
      res.status(403).json({ error: 'Requested logs scope is out of bounds' });
      return;
    }

    const scopedContainer = await prisma.container.findFirst({
      where: scopedContainerWhere(scope, {
        id: containerId,
        hostId,
      }),
      select: {
        id: true,
      },
    });

    if (!scopedContainer) {
      res.status(403).json({ error: 'Requested logs scope is out of bounds' });
      return;
    }

    const result = await getLogsRange({
      scope: {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        hostId,
        containerId,
      },
      start,
      end,
      limit,
    });

    res.json({
      scope: result.scope,
      lines: result.lines,
      retention: result.metadata,
    });
  } catch (error) {
    console.error('Logs query error:', error);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

logsRouter.post('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = logsExportBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid logs export payload',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { organizationId, projectId, hostId, containerId, format, range } = parsed.data;

    const scope = await resolveUserScope({
      userId: req.user!.id,
      organizationId,
      projectId,
    });

    if (!scope) {
      res.status(403).json({ error: 'Requested logs scope is out of bounds' });
      return;
    }

    const scopedContainer = await prisma.container.findFirst({
      where: scopedContainerWhere(scope, {
        id: containerId,
        hostId,
      }),
      select: {
        id: true,
      },
    });

    if (!scopedContainer) {
      res.status(403).json({ error: 'Requested logs scope is out of bounds' });
      return;
    }

    const now = new Date();
    const resolvedRange = resolveExportRange(range, now);
    if (!resolvedRange) {
      res.status(400).json({ error: 'Invalid logs export range. start/end must be valid ISO timestamps and start <= end.' });
      return;
    }

    const result = await getLogsRange({
      scope: {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        hostId,
        containerId,
      },
      start: resolvedRange.start.toISOString(),
      end: resolvedRange.end.toISOString(),
      limit: 20_000,
      now,
    });

    const bodyLines = result.lines.map((line) => formatExportLine(line, format));
    const serialized = `${bodyLines.join('\n')}${bodyLines.length > 0 ? '\n' : ''}`;
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');
    const lineCount = result.lines.length;

    const download = {
      fileName: buildExportFileName({
        projectId: scope.projectId,
        hostId,
        containerId,
        start: resolvedRange.start,
        end: resolvedRange.end,
        format,
      }),
      format,
      contentType: getContentType(format),
      data: serialized,
      lineCount,
      sizeBytes,
    };

    if (sizeBytes <= EXPORT_BACKGROUND_THRESHOLD_BYTES && lineCount <= EXPORT_BACKGROUND_THRESHOLD_LINES) {
      res.json({
        delivery: 'direct',
        download,
        retention: result.metadata,
      });
      return;
    }

    const id = randomUUID();
    const queuedJob: LogsExportJob = {
      id,
      ownerUserId: req.user!.id,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      download: null,
      retention: result.metadata,
      error: null,
    };
    exportJobs.set(id, queuedJob);

    setTimeout(() => {
      const existing = exportJobs.get(id);
      if (!existing) {
        return;
      }

      exportJobs.set(id, {
        ...existing,
        status: 'running',
        updatedAt: new Date(),
      });

      setTimeout(() => {
        const running = exportJobs.get(id);
        if (!running) {
          return;
        }

        exportJobs.set(id, {
          ...running,
          status: 'ready',
          updatedAt: new Date(),
          download,
        });
      }, 10);
    }, 0);

    res.status(202).json({
      delivery: 'background',
      job: {
        id,
        status: 'queued',
      },
      retention: result.metadata,
    });
  } catch (error) {
    console.error('Logs export request failed:', error);
    res.status(500).json({ error: 'Failed to start logs export' });
  }
});

logsRouter.get('/exports/:id', async (req: Request, res: Response): Promise<void> => {
  const params = logsExportJobParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: 'Invalid export job id' });
    return;
  }

  const existing = exportJobs.get(params.data.id);
  if (!existing) {
    res.status(404).json({ error: 'Export job not found' });
    return;
  }

  if (existing.ownerUserId !== req.user!.id) {
    res.status(403).json({ error: 'Export job is out of bounds' });
    return;
  }

  if (isJobExpired(existing)) {
    const expired: LogsExportJob = {
      ...existing,
      status: 'expired',
      updatedAt: new Date(),
      download: null,
    };
    exportJobs.set(existing.id, expired);
    res.json({
      id: expired.id,
      status: expired.status,
      retention: expired.retention,
      error: expired.error,
      updatedAt: expired.updatedAt.toISOString(),
    });
    return;
  }

  res.json({
    id: existing.id,
    status: existing.status,
    retention: existing.retention,
    error: existing.error,
    updatedAt: existing.updatedAt.toISOString(),
    download: existing.status === 'ready' ? existing.download : undefined,
  });
});

export default logsRouter;
