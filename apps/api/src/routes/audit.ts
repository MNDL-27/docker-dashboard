import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const orgId = req.headers['x-organization-id'] as string;

        if (!orgId) {
            res.status(400).json({ error: 'Organization ID is required' });
            return;
        }

        const logs = await prisma.auditLog.findMany({
            where: {
                organizationId: orgId
            },
            orderBy: {
                timestamp: 'desc'
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
