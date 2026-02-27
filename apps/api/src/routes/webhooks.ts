import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireAuth to all webhook routes
router.use(requireAuth);

// GET /api/webhooks - List webhooks for an organization
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required (x-organization-id header)' });
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

        const webhooks = await prisma.webhook.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ webhooks });
    } catch (error) {
        console.error('List webhooks error:', error);
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
});

// POST /api/webhooks - Create a new webhook
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;
        const { url, secret } = req.body;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        if (!url) {
            res.status(400).json({ error: 'Webhook URL is required' });
            return;
        }

        // Check membership with ADMIN+ role
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

        const webhook = await prisma.webhook.create({
            data: {
                organizationId: orgId,
                url,
                secret: secret || null,
            },
        });

        res.status(201).json({ webhook });
    } catch (error) {
        console.error('Create webhook error:', error);
        res.status(500).json({ error: 'Failed to create webhook' });
    }
});

// PUT /api/webhooks/:id - Update a webhook
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;
        const { id } = req.params;
        const { url, secret, isActive } = req.body;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        // Check membership with ADMIN+ role
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

        // Verify webhook belongs to this org
        const existing = await prisma.webhook.findUnique({ where: { id } });
        if (!existing || existing.organizationId !== orgId) {
            res.status(404).json({ error: 'Webhook not found' });
            return;
        }

        const webhook = await prisma.webhook.update({
            where: { id },
            data: {
                ...(url !== undefined && { url }),
                ...(secret !== undefined && { secret }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json({ webhook });
    } catch (error) {
        console.error('Update webhook error:', error);
        res.status(500).json({ error: 'Failed to update webhook' });
    }
});

// DELETE /api/webhooks/:id - Delete a webhook
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.headers['x-organization-id'] as string;
        const { id } = req.params;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        // Check membership with ADMIN+ role
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

        // Verify webhook belongs to this org
        const existing = await prisma.webhook.findUnique({ where: { id } });
        if (!existing || existing.organizationId !== orgId) {
            res.status(404).json({ error: 'Webhook not found' });
            return;
        }

        await prisma.webhook.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('Delete webhook error:', error);
        res.status(500).json({ error: 'Failed to delete webhook' });
    }
});

export default router;
