import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireOrgPermission, requireOrgScope } from '../middleware/scope';

const router = Router();

// Apply requireAuth to all webhook routes
router.use(requireAuth);

// GET /api/webhooks - List webhooks for an organization (optional projectId filter)
router.get('/', requireOrgScope(), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId, projectId: scopedProjectId } = req.scope!;
        const projectId = req.query.projectId as string | undefined;

        const whereClause: any = {
            organizationId,
            ...(scopedProjectId ? { projectId: scopedProjectId } : {}),
        };
        if (projectId !== undefined) {
            // projectId=null returns org-wide webhooks; projectId=<id> returns that project's
            whereClause.projectId = projectId === 'null' ? null : projectId;
        }

        const webhooks = await prisma.webhook.findMany({
            where: whereClause,
            include: {
                project: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ webhooks });
    } catch (error) {
        console.error('List webhooks error:', error);
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
});

// POST /api/webhooks - Create a new webhook (optional projectId for project-scoped)
router.post('/', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { url, secret, projectId } = req.body;

        if (!url) {
            res.status(400).json({ error: 'Webhook URL is required' });
            return;
        }

        // If projectId is provided, validate it belongs to this org
        if (projectId) {
            const project = await prisma.project.findFirst({
                where: { id: projectId, organizationId },
            });
            if (!project) {
                res.status(400).json({ error: 'Project not found in this organization' });
                return;
            }
        }

        const webhook = await prisma.webhook.create({
            data: {
                organizationId,
                projectId: projectId || null,
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
router.put('/:id', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { id } = req.params;
        const { url, secret, isActive } = req.body;

        // Verify webhook belongs to this org
        const existing = await prisma.webhook.findFirst({ where: { id, organizationId } });
        if (!existing) {
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
router.delete('/:id', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { id } = req.params;

        // Verify webhook belongs to this org
        const existing = await prisma.webhook.findFirst({ where: { id, organizationId } });
        if (!existing) {
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

// POST /api/webhooks/:id/test - Send a test notification to a webhook
router.post('/:id/test', requireOrgPermission({ minimumRole: 'ADMIN' }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.scope!;
        const { id } = req.params;

        // Verify webhook belongs to this org
        const webhook = await prisma.webhook.findFirst({ where: { id, organizationId } });
        if (!webhook) {
            res.status(404).json({ error: 'Webhook not found' });
            return;
        }

        // Send test payload
        const payload = JSON.stringify({
            event: 'webhook.test',
            webhook_id: webhook.id,
            message: 'This is a test notification from Docker Dashboard Cloud.',
            timestamp: new Date().toISOString(),
        });

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (webhook.secret) {
            const crypto = await import('crypto');
            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(payload)
                .digest('hex');
            headers['X-Docker-Dashboard-Signature'] = `sha256=${signature}`;
        }

        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: payload,
            signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) {
            res.json({ success: true, status: response.status, message: 'Test notification delivered successfully' });
        } else {
            res.json({ success: false, status: response.status, message: `Webhook returned HTTP ${response.status}` });
        }
    } catch (error: any) {
        console.error('Test webhook error:', error);
        res.json({ success: false, message: error.message || 'Failed to deliver test notification' });
    }
});

export default router;
