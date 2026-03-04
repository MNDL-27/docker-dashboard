import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  TELEMETRY_WINDOWS,
  getTelemetryHistory,
  resolveTelemetryScopeForUser,
  type TelemetryWindow,
} from '../services/telemetryQuery';

const router = Router();

const metricsHistoryQuerySchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  hostId: z.string().min(1).optional(),
  containerId: z.string().min(1).optional(),
  window: z.enum(TELEMETRY_WINDOWS).default('1h'),
  topN: z.coerce.number().int().min(1).max(25).optional(),
});

router.use(requireAuth);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = metricsHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid metrics query parameters',
        details: parsed.error.flatten(),
      });
      return;
    }

    const scope = await resolveTelemetryScopeForUser({
      userId: req.user!.id,
      organizationId: parsed.data.organizationId,
      projectId: parsed.data.projectId,
      hostId: parsed.data.hostId,
      containerId: parsed.data.containerId,
    });

    if (!scope) {
      res.status(403).json({ error: 'Requested telemetry scope is out of bounds' });
      return;
    }

    const result = await getTelemetryHistory({
      scope,
      window: parsed.data.window as TelemetryWindow,
      topN: parsed.data.topN,
    });

    res.json(result);
  } catch (error) {
    console.error('Metrics history query error:', error);
    res.status(500).json({ error: 'Failed to load telemetry metrics' });
  }
});

router.get('/live', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = metricsHistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid live metrics query parameters',
        details: parsed.error.flatten(),
      });
      return;
    }

    const scope = await resolveTelemetryScopeForUser({
      userId: req.user!.id,
      organizationId: parsed.data.organizationId,
      projectId: parsed.data.projectId,
      hostId: parsed.data.hostId,
      containerId: parsed.data.containerId,
    });

    if (!scope) {
      res.status(403).json({ error: 'Requested telemetry scope is out of bounds' });
      return;
    }

    const snapshot = await getTelemetryHistory({
      scope,
      window: parsed.data.window as TelemetryWindow,
      topN: parsed.data.topN,
    });

    res.json({
      scope: snapshot.scope,
      window: snapshot.window,
      aggregate: snapshot.aggregate,
      topContributors: snapshot.topContributors,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Live metrics query error:', error);
    res.status(500).json({ error: 'Failed to load live telemetry snapshot' });
  }
});

export default router;
