import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { authenticateAgentWS } from './auth';
import { saveMetricsBatch } from '../services/metrics';
import { saveLogsBatch } from '../services/logs';

export const wss = new WebSocketServer({ noServer: true });

// active connections maps
export const agentClients = new Map<string, WebSocket>();
export const webClients = new Map<string, WebSocket>();

// Store a list of connections for one user if they open multiple tabs
export function addWebClient(userId: string, ws: WebSocket) {
    webClients.set(userId, ws);
}

// Added for Phase 3: Action Relay
const actionResolvers = new Map<string, { resolve: (val: boolean) => void, reject: (err: any) => void }>();

export function sendActionToAgent(hostId: string, payload: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const ws = agentClients.get(hostId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return resolve(false); // Agent offline
        }

        // Register promise
        const actionId = payload.action_id;
        actionResolvers.set(actionId, { resolve, reject });

        ws.send(JSON.stringify({ type: 'action', ...payload }));

        // Timeout 15 seconds
        setTimeout(() => {
            if (actionResolvers.has(actionId)) {
                actionResolvers.delete(actionId);
                resolve(false); // Timeout
            }
        }, 15000);
    });
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

                ws.on('message', (data, isBinary) => {
                    if (isBinary) return;
                    try {
                        const payload = JSON.parse(data.toString());
                        if (payload.type === 'metrics') {
                            saveMetricsBatch(hostId, payload.metrics).catch(console.error);
                        } else if (payload.type === 'logs') {
                            saveLogsBatch(hostId, payload.logs).catch(console.error);
                        } else if (payload.type === 'action_result') {
                            // Phase 3: Action result from agent
                            const resFn = actionResolvers.get(payload.action_id);
                            if (resFn) {
                                actionResolvers.delete(payload.action_id);
                                resFn.resolve(payload.status === 'SUCCESS');
                            }
                        }
                    } catch (err) {
                        console.error('Failed to parse WS message from agent:', err);
                    }
                });

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
