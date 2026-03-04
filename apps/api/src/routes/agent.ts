import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
    AGENT_JWT_ALGORITHMS,
    AGENT_JWT_AUDIENCE,
    AGENT_JWT_ISSUER,
    requireAgentAuth,
} from '../middleware/agentAuth';
import { resolveAgentScope } from '../services/scopedAccess';
import { consumeEnrollmentToken } from '../services/enrollment';
import { recordHeartbeat } from '../services/presence';
import { syncContainers, ContainerPayload, HostSnapshotPayload } from '../services/container';

const router = Router();
const JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.SESSION_SECRET || 'fallback_agent_secret';

const enrollSchema = z.object({
    token: z.string().min(1),
    name: z.string().min(1),
    hostname: z.string().min(1),
    os: z.string().min(1),
    architecture: z.string().min(1),
    dockerVersion: z.string().min(1),
});

const hostSnapshotSchema = z.object({
    ipAddress: z.string().trim().min(1).optional(),
    agentVersion: z.string().trim().min(1).optional(),
    cpuCount: z.number().int().nonnegative().optional(),
    memoryTotalBytes: z.number().int().nonnegative().optional(),
});

const containerSnapshotSchema = z.object({
    dockerId: z.string().min(1),
    name: z.string(),
    image: z.string(),
    imageId: z.string(),
    command: z.string(),
    state: z.string(),
    status: z.string(),
    restartCount: z.number().int().nonnegative().optional(),
    ports: z.record(z.unknown()).default({}),
    labels: z.record(z.unknown()).default({}),
    networks: z.record(z.unknown()).optional(),
    volumes: z.array(z.string()).optional(),
    createdAt: z.string().datetime().nullable().optional(),
    startedAt: z.string().datetime().nullable().optional(),
});

const inventorySnapshotSchema = z.union([
    z.array(containerSnapshotSchema),
    z.object({
        host: hostSnapshotSchema.optional(),
        containers: z.array(containerSnapshotSchema),
    }),
]);

// POST /agent/enroll - Agent enrollment
router.post('/enroll', async (req: Request, res: Response): Promise<void> => {
    try {
        const result = enrollSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ error: 'Invalid enrollment payload', details: result.error.errors });
            return;
        }

        const payload = result.data;

        const host = await consumeEnrollmentToken(prisma, payload);

        if (!host) {
            res.status(401).json({ error: 'Invalid enrollment token' });
            return;
        }

        // Generate Agent JWT
        const agentToken = jwt.sign(
            {
                hostId: host.hostId,
                organizationId: host.organizationId,
                projectId: host.projectId,
            },
            JWT_SECRET,
            {
                algorithm: AGENT_JWT_ALGORITHMS[0],
                issuer: AGENT_JWT_ISSUER,
                audience: AGENT_JWT_AUDIENCE,
                expiresIn: '30d',
            }
        );

        res.status(200).json({
            agentToken,
            hostId: host.hostId,
            organizationId: host.organizationId,
            projectId: host.projectId,
        });
    } catch (error) {
        console.error('Agent enrollment error:', error);
        res.status(500).json({ error: 'Failed to enroll agent' });
    }
});

// POST /agent/heartbeat - Agent heartbeat
router.post('/heartbeat', requireAgentAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { hostId, organizationId, projectId } = req.agent!;

        const validScope = await resolveAgentScope({ hostId, organizationId, projectId });
        if (!validScope) {
            res.status(403).json({ error: 'Out-of-scope agent context' });
            return;
        }

        await prisma.host.update({
            where: { id: hostId },
            data: recordHeartbeat(),
            select: { id: true } // Minimal return
        });

        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Agent heartbeat error:', error);
        res.status(500).json({ error: 'Failed to process heartbeat' });
    }
});

// POST /agent/containers - Sync container snapshots
router.post('/containers', requireAgentAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { hostId, organizationId, projectId } = req.agent!;
        const payloadResult = inventorySnapshotSchema.safeParse(req.body);

        if (!payloadResult.success) {
            res.status(400).json({ error: 'Invalid container snapshot payload', details: payloadResult.error.errors });
            return;
        }

        let containers: ContainerPayload[];
        let hostSnapshot: HostSnapshotPayload | undefined;

        if (Array.isArray(payloadResult.data)) {
            containers = payloadResult.data;
        } else {
            containers = payloadResult.data.containers;
            hostSnapshot = payloadResult.data.host;
        }

        const validScope = await resolveAgentScope({ hostId, organizationId, projectId });
        if (!validScope) {
            res.status(403).json({ error: 'Out-of-scope agent context' });
            return;
        }

        const { added, updated, removed } = await syncContainers(hostId, containers, hostSnapshot);

        // Also update host lastSeen
        await prisma.host.update({
            where: { id: hostId },
            data: recordHeartbeat(),
            select: { id: true },
        });

        res.status(200).json({
            status: 'ok',
            summary: { added, updated, removed }
        });
    } catch (error) {
        console.error('Agent container sync error:', error);
        res.status(500).json({ error: 'Failed to sync containers' });
    }
});

export default router;
