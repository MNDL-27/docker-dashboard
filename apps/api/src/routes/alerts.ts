import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireOrgPermission, requireOrgScope } from '../middleware/scope';
import { scopedContainerWhere } from '../services/scopedAccess';

const router = Router();

// Apply requireAuth to all alert routes
router.use(requireAuth);

// GET /api/alerts - List alerts for an organization (optional projectId filter)
router.get('/', requireOrgScope(), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId, projectId } = req.scope!;
        const status = req.query.status as string | undefined;
        const hostId = req.query.hostId as string | undefined;
        const containerId = req.query.containerId as string | undefined;

        const alerts = await prisma.alert.findMany({
            where: {
                rule: {
                    organizationId,
                    ...(projectId ? { projectId } : {}),
                },
                ...(status ? { status } : {}),
                ...(containerId ? { containerId } : {}),
                container: scopedContainerWhere(req.scope!, {
                    ...(hostId ? { hostId } : {}),
                }),
            },
            include: {
                rule: {
                    select: {
                        name: true,
                        condition: true,
                        threshold: true,
                        duration: true,
                    },
                },
                container: {
                    select: {
                        name: true,
                        dockerId: true,
                        image: true,
                        host: {
                            select: {
                                name: true,
                                projectId: true,
                            },
                        },
                    },
                },
            },
            orderBy: { startedAt: 'desc' },
            take: 200,
        });

        res.json({ alerts });
    } catch (error) {
        console.error('List alerts error:', error);
        res.status(500).json({ error: 'Failed to list alerts' });
    }
});

// GET /api/alerts/rules - List alert rules for an organization (optional projectId filter)
router.get('/rules', requireOrgScope(), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId, projectId: scopedProjectId } = req.scope!;
        const projectId = req.query.projectId as string | undefined;

        const whereClause: any = {
            organizationId,
            ...(scopedProjectId ? { projectId: scopedProjectId } : {}),
        };
        if (projectId !== undefined) {
            whereClause.projectId = projectId === 'null' ? null : projectId;
        }

        const rules = await prisma.alertRule.findMany({
            where: whereClause,
            include: {
                project: {
                    select: { id: true, name: true },
                },
                _count: {
                    select: { alerts: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ rules });
    } catch (error) {
        console.error('List alert rules error:', error);
        res.status(500).json({ error: 'Failed to list alert rules' });
    }
});

// POST /api/alerts/rules - Create an alert rule (optional projectId for project-scoped)
router.post('/rules', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { name, condition, threshold, duration, projectId } = req.body;

        if (!name || !condition || duration === undefined) {
            res.status(400).json({ error: 'name, condition, and duration are required' });
            return;
        }

        const validConditions = ['CONTAINER_DOWN', 'RESTART_LOOP', 'CPU_USAGE', 'MEMORY_USAGE'];
        if (!validConditions.includes(condition)) {
            res.status(400).json({ error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` });
            return;
        }

        // If projectId is provided, validate it
        if (projectId) {
            const project = await prisma.project.findFirst({
                where: { id: projectId, organizationId },
            });
            if (!project) {
                res.status(400).json({ error: 'Project not found in this organization' });
                return;
            }
        }

        const rule = await prisma.alertRule.create({
            data: {
                organizationId,
                projectId: projectId || null,
                name,
                condition,
                threshold: threshold !== undefined ? parseFloat(threshold) : null,
                duration: parseInt(duration, 10),
            },
        });

        res.status(201).json({ rule });
    } catch (error) {
        console.error('Create alert rule error:', error);
        res.status(500).json({ error: 'Failed to create alert rule' });
    }
});

// PUT /api/alerts/rules/:id - Update an alert rule
router.put('/rules/:id', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { id } = req.params;
        const { name, condition, threshold, duration } = req.body;

        const existing = await prisma.alertRule.findFirst({ where: { id, organizationId } });
        if (!existing) {
            res.status(404).json({ error: 'Alert rule not found' });
            return;
        }

        if (condition) {
            const validConditions = ['CONTAINER_DOWN', 'RESTART_LOOP', 'CPU_USAGE', 'MEMORY_USAGE'];
            if (!validConditions.includes(condition)) {
                res.status(400).json({ error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` });
                return;
            }
        }

        const rule = await prisma.alertRule.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(condition !== undefined && { condition }),
                ...(threshold !== undefined && { threshold: parseFloat(threshold) }),
                ...(duration !== undefined && { duration: parseInt(duration, 10) }),
            },
        });

        res.json({ rule });
    } catch (error) {
        console.error('Update alert rule error:', error);
        res.status(500).json({ error: 'Failed to update alert rule' });
    }
});

// DELETE /api/alerts/rules/:id - Delete an alert rule (cascades alerts)
router.delete('/rules/:id', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { id } = req.params;

        const existing = await prisma.alertRule.findFirst({ where: { id, organizationId } });
        if (!existing) {
            res.status(404).json({ error: 'Alert rule not found' });
            return;
        }

        await prisma.alertRule.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('Delete alert rule error:', error);
        res.status(500).json({ error: 'Failed to delete alert rule' });
    }
});

export default router;
