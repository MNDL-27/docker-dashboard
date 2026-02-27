import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply requireAuth to all host routes
router.use(requireAuth);

// GET /hosts - List hosts for an organization
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const organizationId = req.query.organizationId as string;

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId query parameter is required' });
            return;
        }

        // Check membership
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const hosts = await prisma.host.findMany({
            where: { organizationId },
            include: {
                _count: {
                    select: { containers: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        // Compute online status if not updated in DB
        const now = new Date().getTime();
        const formattedHosts = hosts.map(host => {
            let isOnline = host.status === 'ONLINE';
            if (host.lastSeen) {
                const lastSeenTime = new Date(host.lastSeen).getTime();
                if (now - lastSeenTime > 60000) { // 1 minute threshold
                    isOnline = false;
                } else {
                    isOnline = true;
                }
            } else {
                isOnline = false;
            }

            return {
                ...host,
                status: isOnline ? 'ONLINE' : 'OFFLINE',
                containerCount: host._count.containers,
                _count: undefined,
            };
        });

        res.json({ hosts: formattedHosts });
    } catch (error) {
        console.error('List hosts error:', error);
        res.status(500).json({ error: 'Failed to list hosts' });
    }
});

// GET /hosts/:id - Get single host details
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const host = await prisma.host.findUnique({
            where: { id },
        });

        if (!host) {
            res.status(404).json({ error: 'Host not found' });
            return;
        }

        // Check membership
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: host.organizationId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        res.json({ host });
    } catch (error) {
        console.error('Get host error:', error);
        res.status(500).json({ error: 'Failed to get host' });
    }
});

// POST /hosts/tokens - Generate a host enrollment token
router.post('/tokens', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { organizationId } = req.body;

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId is required' });
            return;
        }

        // Check ownership or admin
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
            res.status(403).json({ error: 'Insufficient permissions. Must be OWNER or ADMIN.' });
            return;
        }

        // Generate token (Prisma will use gen_random_uuid())
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

        const hostToken = await prisma.hostToken.create({
            data: {
                organizationId,
                createdBy: userId,
                expiresAt,
            },
        });

        const apiUrl = process.env.PUBLIC_API_URL || 'http://localhost:3001';

        // Command for starting the agent
        const command = `docker run -d --name docker-dashboard-agent \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -e AGENT_API_URL="${apiUrl}" \\
  -e AGENT_TOKEN="${hostToken.token}" \\
  docker-dashboard-agent:latest`;

        res.status(201).json({
            token: hostToken.token,
            expiresAt: hostToken.expiresAt,
            command
        });
    } catch (error) {
        console.error('Generate token error:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});
// GET /hosts/:id/containers - List containers for a host
router.get('/:id/containers', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const host = await prisma.host.findUnique({
            where: { id },
        });

        if (!host) {
            res.status(404).json({ error: 'Host not found' });
            return;
        }

        // Check membership
        const membership = await prisma.organizationMember.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: host.organizationId,
                },
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const containers = await prisma.container.findMany({
            where: { hostId: id },
            orderBy: { name: 'asc' },
        });

        res.json({ containers });
    } catch (error) {
        console.error('List containers error:', error);
        res.status(500).json({ error: 'Failed to list containers' });
    }
});

export default router;
