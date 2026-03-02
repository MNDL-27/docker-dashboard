import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { resolveUserScope } from '../services/scopedAccess';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const orgId = (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);
        const projectId = (req.headers['x-project-id'] as string | undefined) || (req.query.projectId as string | undefined);
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        const scope = await resolveUserScope({ userId, organizationId: orgId, projectId });
        if (!scope) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        let projectDockerIds: string[] | undefined;
        if (scope.projectId) {
            const projectContainers = await prisma.container.findMany({
                where: {
                    host: {
                        organizationId: scope.organizationId,
                        projectId: scope.projectId,
                    },
                },
                select: {
                    dockerId: true,
                },
            });
            projectDockerIds = projectContainers.map((container) => container.dockerId);
        }

        const logs = await prisma.auditLog.findMany({
            where: {
                organizationId: scope.organizationId,
                ...(scope.projectId
                    ? {
                          targetType: 'CONTAINER',
                          targetId: {
                              in: projectDockerIds ?? [],
                          },
                      }
                    : {}),
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100, // Limit to 100 for MVP
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.json({ logs });
    } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
