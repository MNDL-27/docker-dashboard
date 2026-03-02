import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { resolveAgentScope } from '../services/scopedAccess';
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
        const decoded = jwt.verify(token, JWT_SECRET) as {
            hostId: string;
            organizationId: string;
            projectId: string;
        };

        const isInScope = await resolveAgentScope({
            hostId: decoded.hostId,
            organizationId: decoded.organizationId,
            projectId: decoded.projectId,
        });

        if (!isInScope) {
            return null;
        }

        return decoded.hostId;
    } catch (err) {
        return null;
    }
}
