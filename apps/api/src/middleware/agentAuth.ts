import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

declare global {
    namespace Express {
        interface Request {
            agent?: {
                hostId: string;
                organizationId: string;
            };
        }
    }
}

const JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.SESSION_SECRET || 'fallback_agent_secret';

export async function requireAgentAuth(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or invalid Agent Authorization header' });
            return;
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { hostId: string; organizationId: string };

            // Verify host still exists and is not deleted/deauthorized
            const host = await prisma.host.findUnique({
                where: { id: decoded.hostId },
                select: { id: true, organizationId: true }
            });

            if (!host || host.organizationId !== decoded.organizationId) {
                res.status(401).json({ error: 'Invalid agent identity' });
                return;
            }

            req.agent = {
                hostId: decoded.hostId,
                organizationId: decoded.organizationId,
            };

            next();
        } catch (err) {
            res.status(401).json({ error: 'Invalid or expired Agent token' });
            return;
        }
    } catch (error) {
        console.error('Agent auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
}
