import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { sendActionToAgent } from '../websocket/server';

const router = Router();

router.post('/:containerId/actions', requireAuth, async (req, res) => {
    try {
        const { containerId } = req.params;
        const { action, reason } = req.body;

        if (!['START', 'STOP', 'RESTART'].includes(action)) {
            res.status(400).json({ error: 'Invalid action line' });
            return;
        }

        const container = await prisma.container.findFirst({
            where: { dockerId: containerId }, // assuming UI sends dockerId
            include: { host: true }
        });

        if (!container) {
            res.status(404).json({ error: 'Container not found' });
            return;
        }

        // Ensure we have user and org from auth middleware
        const userId = req.user?.id;
        const orgId = req.headers['x-organization-id'] as string; // or however org is resolved in your app
        const organizationId = orgId || container.host.organizationId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Ideally do RBAC check here if the user has permission to stop protected containers

        // Send to agent
        const actionId = crypto.randomUUID();
        const success = await sendActionToAgent(container.hostId, {
            action_id: actionId,
            action: action,
            containerId: container.dockerId,
            reason: reason,
        });

        if (!success) {
            await prisma.auditLog.create({
                data: {
                    userId,
                    organizationId,
                    action,
                    targetType: 'CONTAINER',
                    targetId: container.dockerId,
                    status: 'FAILURE',
                    reason: reason || 'Action failed or agent offline',
                }
            });
            res.status(503).json({ error: 'Agent is not connected or timed out processing request' });
            return;
        }

        // The agent executed it successfully
        await prisma.auditLog.create({
            data: {
                userId,
                organizationId,
                action,
                targetType: 'CONTAINER',
                targetId: container.dockerId,
                status: 'SUCCESS',
                reason: reason || 'Action executed successfully',
            }
        });

        res.status(200).json({ status: 'SUCCESS', action_id: actionId });
    } catch (err: any) {
        console.error('Action error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
