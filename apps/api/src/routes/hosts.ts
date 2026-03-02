import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { getPublicApiUrl } from '../config/transport';
import { resolveUserScope, scopedHostWhere, scopedContainerWhere } from '../services/scopedAccess';

const router = Router();

// Apply requireAuth to all host routes
router.use(requireAuth);

// GET /hosts - List hosts for an organization
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const organizationId = req.query.organizationId as string;
        const projectId = req.query.projectId as string | undefined;

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId query parameter is required' });
            return;
        }

        const scope = await resolveUserScope({ userId, organizationId, projectId });
        if (!scope) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const hosts = await prisma.host.findMany({
            where: scopedHostWhere(scope),
            include: {
                project: {
                    select: { id: true, name: true },
                },
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
        const organizationId = (req.query.organizationId as string) || (req.headers['x-organization-id'] as string);
        const projectId = (req.query.projectId as string | undefined) || (req.headers['x-project-id'] as string | undefined);

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId query parameter or x-organization-id header is required' });
            return;
        }

        const scope = await resolveUserScope({ userId, organizationId, projectId });
        if (!scope) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const host = await prisma.host.findFirst({
            where: scopedHostWhere(scope, { id }),
        });

        if (!host) {
            res.status(404).json({ error: 'Host not found' });
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
        const { organizationId, projectId } = req.body;

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId is required' });
            return;
        }

        if (!projectId) {
            res.status(400).json({ error: 'projectId is required' });
            return;
        }

        const scope = await resolveUserScope({ userId, organizationId, projectId });
        if (!scope) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        if (scope.role !== 'OWNER' && scope.role !== 'ADMIN' && scope.role !== 'OPERATOR') {
            res.status(403).json({ error: 'Insufficient permissions. Must be OWNER, ADMIN, or OPERATOR.' });
            return;
        }

        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId: scope.organizationId },
        });

        if (!project) {
            res.status(400).json({ error: 'Project not found in this organization' });
            return;
        }

        // Generate token (Prisma will use gen_random_uuid())
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

        const hostToken = await prisma.hostToken.create({
            data: {
                organizationId: scope.organizationId,
                projectId: scope.projectId!,
                createdBy: userId,
                expiresAt,
            },
        });

        const apiUrl = getPublicApiUrl();

        // Command for starting the agent
        const command = `docker run -d --name docker-dashboard-agent \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -e AGENT_API_URL="${apiUrl}" \\
  -e AGENT_TOKEN="${hostToken.token}" \\
  docker-dashboard-agent:latest`;

        res.status(201).json({
            token: hostToken.token,
            expiresAt: hostToken.expiresAt,
            projectId: project.id,
            projectName: project.name,
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
        const organizationId = (req.query.organizationId as string) || (req.headers['x-organization-id'] as string);
        const projectId = (req.query.projectId as string | undefined) || (req.headers['x-project-id'] as string | undefined);

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId query parameter or x-organization-id header is required' });
            return;
        }

        const scope = await resolveUserScope({ userId, organizationId, projectId });
        if (!scope) {
            res.status(403).json({ error: 'Not a member of this organization' });
            return;
        }

        const host = await prisma.host.findFirst({
            where: scopedHostWhere(scope, { id }),
        });

        if (!host) {
            res.status(404).json({ error: 'Host not found' });
            return;
        }

        const containers = await prisma.container.findMany({
            where: scopedContainerWhere(scope, { hostId: id }),
            orderBy: { name: 'asc' },
        });

        res.json({ containers });
    } catch (error) {
        console.error('List containers error:', error);
        res.status(500).json({ error: 'Failed to list containers' });
    }
});

export default router;
