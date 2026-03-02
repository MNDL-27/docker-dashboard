import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { getPublicApiUrl } from '../config/transport';
import { resolveUserScope, scopedHostWhere, scopedContainerWhere } from '../services/scopedAccess';
import { buildEnrollmentInstallCommand, issueEnrollmentToken } from '../services/enrollment';
import { deriveHostConnectivity } from '../services/presence';

const router = Router();
const TOKEN_CREATOR_ROLES = new Set(['OWNER', 'ADMIN', 'OPERATOR']);

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

        const formattedHosts = hosts.map(host => {
            const presence = deriveHostConnectivity(host.lastSeen);

            return {
                ...host,
                status: presence.status,
                lastSeen: presence.lastSeen,
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

        const presence = deriveHostConnectivity(host.lastSeen);
        res.json({
            host: {
                ...host,
                status: presence.status,
                lastSeen: presence.lastSeen,
            },
        });
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

        if (!TOKEN_CREATOR_ROLES.has(scope.role)) {
            res.status(403).json({ error: 'Insufficient permissions. Must be OWNER, ADMIN, or OPERATOR.' });
            return;
        }

        const enrollmentResult = await prisma.$transaction(async (tx) => {
            const project = await tx.project.findFirst({
                where: { id: projectId, organizationId: scope.organizationId },
                select: { id: true, name: true },
            });

            if (!project) {
                return null;
            }

            const issuedToken = await issueEnrollmentToken(tx, {
                organizationId: scope.organizationId,
                projectId: scope.projectId!,
                createdBy: userId,
            });

            return { project, issuedToken };
        });

        if (!enrollmentResult) {
            res.status(400).json({ error: 'Project not found in this organization' });
            return;
        }

        const { project, issuedToken } = enrollmentResult;

        const apiUrl = getPublicApiUrl();
        const command = buildEnrollmentInstallCommand(apiUrl, issuedToken.token);

        res.status(201).json({
            token: issuedToken.token,
            expiresAt: issuedToken.expiresAt,
            cloudUrl: apiUrl,
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
