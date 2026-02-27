import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import url from 'url';

const JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.SESSION_SECRET || 'fallback_agent_secret';

export async function authenticateAgentWS(req: IncomingMessage): Promise<string | null> {
    const parsedUrl = url.parse(req.url || '', true);
    let token = parsedUrl.query.token as string;

    if (!token && req.headers['authorization']?.startsWith('Bearer ')) {
        token = req.headers['authorization'].split(' ')[1];
    }

    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { hostId: string; organizationId: string };

        const host = await prisma.host.findUnique({
            where: { id: decoded.hostId },
            select: { id: true, organizationId: true }
        });

        if (!host || host.organizationId !== decoded.organizationId) {
            return null;
        }

        return decoded.hostId;
    } catch (err) {
        return null;
    }
}
