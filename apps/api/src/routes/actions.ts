import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { sendActionToAgent } from '../websocket/server';
import { resolveUserScope, scopedContainerWhere } from '../services/scopedAccess';

const router = Router();

router.post('/:containerId/actions', requireAuth, async (req, res) => {
    try {
        const { containerId } = req.params;
        const { action, reason } = req.body;
        const organizationId = (req.headers['x-organization-id'] as string) || (req.body?.organizationId as string) || (req.query.organizationId as string);
        const projectId = (req.headers['x-project-id'] as string | undefined) || (req.body?.projectId as string | undefined) || (req.query.projectId as string | undefined);

        if (!['START', 'STOP', 'RESTART'].includes(action)) {
            res.status(400).json({ error: 'Invalid action line' });
            return;
        }

        if (!organizationId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const scope = await resolveUserScope({ userId, organizationId, projectId });
        if (!scope) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const container = await prisma.container.findFirst({
            where: scopedContainerWhere(scope, { dockerId: containerId }),
            include: { host: true }
        });

        if (!container) {
            res.status(404).json({ error: 'Container not found' });
            return;
        }

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
                    organizationId: scope.organizationId,
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
                organizationId: scope.organizationId,
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
