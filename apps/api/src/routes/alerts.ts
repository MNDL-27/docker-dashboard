import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireAuth to all alert routes
router.use(requireAuth);

// GET /api/alerts - List alerts for an organization
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        // Check membership
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user!.id,
                    organizationId: orgId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const alerts = await prisma.alert.findMany({
            where: {
                rule: {
                    organizationId: orgId,
                },
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

// GET /api/alerts/rules - List alert rules for an organization
router.get('/rules', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user!.id,
                    organizationId: orgId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const rules = await prisma.alertRule.findMany({
            where: { organizationId: orgId },
            include: {
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

// POST /api/alerts/rules - Create an alert rule
router.post('/rules', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;
        const { name, condition, threshold, duration } = req.body;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        if (!name || !condition || duration === undefined) {
            res.status(400).json({ error: 'name, condition, and duration are required' });
            return;
        }

        const validConditions = ['CONTAINER_DOWN', 'RESTART_LOOP', 'CPU_USAGE', 'MEMORY_USAGE'];
        if (!validConditions.includes(condition)) {
            res.status(400).json({ error: `Invalid condition. Must be one of: ${validConditions.join(', ')}` });
            return;
        }

        // Check ADMIN+ membership
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user!.id,
                    organizationId: orgId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        if (!['OWNER', 'ADMIN'].includes(membership.role)) {
            res.status(403).json({ error: 'Insufficient permissions. Must be OWNER or ADMIN.' });
            return;
        }

        const rule = await prisma.alertRule.create({
            data: {
                organizationId: orgId,
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
router.put('/rules/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;
        const { id } = req.params;
        const { name, condition, threshold, duration } = req.body;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user!.id,
                    organizationId: orgId,
                },
            },
        });

        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        const existing = await prisma.alertRule.findUnique({ where: { id } });
        if (!existing || existing.organizationId !== orgId) {
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
router.delete('/rules/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;
        const { id } = req.params;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId: req.user!.id,
                    organizationId: orgId,
                },
            },
        });

        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        const existing = await prisma.alertRule.findUnique({ where: { id } });
        if (!existing || existing.organizationId !== orgId) {
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
