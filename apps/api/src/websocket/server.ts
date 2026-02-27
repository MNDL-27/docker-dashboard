import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { authenticateAgentWS } from './auth';

export const wss = new WebSocketServer({ noServer: true });

// active connections maps
export const agentClients = new Map<string, WebSocket>();
export const webClients = new Map<string, WebSocket>();

// Store a list of connections for one user if they open multiple tabs
export function addWebClient(userId: string, ws: WebSocket) {
    webClients.set(userId, ws);
}

export function handleUpgrade(req: IncomingMessage, socket: any, head: Buffer, sessionMiddleware: any) {
    const pathname = req.url ? req.url.split('?')[0] : '';

    if (pathname.startsWith('/ws/agent')) {
        authenticateAgentWS(req).then(hostId => {
            if (!hostId) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, (ws) => {
                agentClients.set(hostId, ws);

                // Keepalive loop
                const interval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    }
                }, 30000);

                ws.on('close', () => {
                    clearInterval(interval);
                    agentClients.delete(hostId);
                });

                // Pass ws to connection handler to bind messages later
                wss.emit('connection', ws, req, { type: 'agent', id: hostId });
            });
        });
    } else if (pathname.startsWith('/ws/client')) {
        // use sessionMiddleware to get req.session
        // Web clients will send cookie headers implicitly
        sessionMiddleware(req as any, {} as any, () => {
            const session = (req as any).session;
            if (!session || !session.userId) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, (ws) => {
                addWebClient(session.userId, ws);

                // Keepalive
                const interval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    }
                }, 30000);

                ws.on('close', () => {
                    clearInterval(interval);
                    webClients.delete(session.userId); // Note: handles single connection for simplicity
                });

                wss.emit('connection', ws, req, { type: 'client', id: session.userId });
            });
        });
    } else {
        socket.destroy();
    }
}
