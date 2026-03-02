import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { requireAgentAuth } from '../middleware/agentAuth';
import { resolveAgentScope } from '../services/scopedAccess';
import { consumeEnrollmentToken } from '../services/enrollment';

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
            { expiresIn: '30d' }
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
            data: {
                lastSeen: new Date(),
                status: 'ONLINE',
            },
            select: { id: true } // Minimal return
        });

        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Agent heartbeat error:', error);
        res.status(500).json({ error: 'Failed to process heartbeat' });
    }
});

import { syncContainers, ContainerPayload } from '../services/container';

// POST /agent/containers - Sync container snapshots
router.post('/containers', requireAgentAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { hostId, organizationId, projectId } = req.agent!;
        const containers: ContainerPayload[] = req.body;

        const validScope = await resolveAgentScope({ hostId, organizationId, projectId });
        if (!validScope) {
            res.status(403).json({ error: 'Out-of-scope agent context' });
            return;
        }

        if (!Array.isArray(containers)) {
            res.status(400).json({ error: 'Expected an array of containers' });
            return;
        }

        const { added, updated, removed } = await syncContainers(hostId, containers);

        // Also update host lastSeen
        await prisma.host.update({
            where: { id: hostId },
            data: { lastSeen: new Date(), status: 'ONLINE' },
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
