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

export default logsRouter;
