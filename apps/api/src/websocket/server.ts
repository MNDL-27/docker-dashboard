import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { authenticateAgentWS } from './auth';
import { saveMetricsBatch } from '../services/metrics';
import { saveLogsBatch } from '../services/logs';
import {
    buildTelemetryFrameFromLiveMetrics,
    resolveTelemetryScopeForUser,
    TELEMETRY_SPEED_PRESETS,
    type TelemetryScope,
    type TelemetrySpeedPreset,
} from '../services/telemetryQuery';

export const wss = new WebSocketServer({ noServer: true });

// active connections maps
export const agentClients = new Map<string, WebSocket>();
export const webClients = new Map<string, WebSocket>();

const SPEED_INTERVAL_MS: Record<TelemetrySpeedPreset, number> = {
    '1x': 1000,
    '2x': 500,
    '4x': 250,
};

export interface TelemetryClientState {
    userId: string;
    scope: TelemetryScope | null;
    paused: boolean;
    speed: TelemetrySpeedPreset;
    topN: number;
    lastFrameAt: number;
}

type TelemetrySubscribeMessage = {
    type: 'metrics.subscribe';
    organizationId: string;
    projectId?: string;
    hostId?: string;
    containerId?: string;
    topN?: number;
};

type TelemetryControlMessage = {
    type: 'metrics.control';
    action: 'pause' | 'resume' | 'set-speed';
    speed?: TelemetrySpeedPreset;
};

const clientStates = new Map<WebSocket, TelemetryClientState>();

function isTelemetrySpeedPreset(value: unknown): value is TelemetrySpeedPreset {
    return typeof value === 'string' && TELEMETRY_SPEED_PRESETS.includes(value as TelemetrySpeedPreset);
}

function coerceTopN(topN: unknown): number {
    const numeric = Number(topN);
    if (!Number.isFinite(numeric)) {
        return 5;
    }

    if (numeric < 1) {
        return 1;
    }

    if (numeric > 25) {
        return 25;
    }

    return Math.floor(numeric);
}

function parseTelemetrySubscribeMessage(payload: unknown): TelemetrySubscribeMessage | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (candidate.type !== 'metrics.subscribe' || typeof candidate.organizationId !== 'string') {
        return null;
    }

    return {
        type: 'metrics.subscribe',
        organizationId: candidate.organizationId,
        projectId: typeof candidate.projectId === 'string' ? candidate.projectId : undefined,
        hostId: typeof candidate.hostId === 'string' ? candidate.hostId : undefined,
        containerId: typeof candidate.containerId === 'string' ? candidate.containerId : undefined,
        topN: typeof candidate.topN === 'number' ? candidate.topN : undefined,
    };
}

function parseTelemetryControlMessage(payload: unknown): TelemetryControlMessage | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (candidate.type !== 'metrics.control') {
        return null;
    }

    if (candidate.action !== 'pause' && candidate.action !== 'resume' && candidate.action !== 'set-speed') {
        return null;
    }

    return {
        type: 'metrics.control',
        action: candidate.action,
        speed: candidate.speed as TelemetrySpeedPreset,
    };
}

export function applyTelemetryControl(state: TelemetryClientState, message: TelemetryControlMessage): TelemetryClientState {
    if (message.action === 'pause') {
        return {
            ...state,
            paused: true,
        };
    }

    if (message.action === 'resume') {
        return {
            ...state,
            paused: false,
        };
    }

    if (message.action === 'set-speed' && message.speed && isTelemetrySpeedPreset(message.speed)) {
        return {
            ...state,
            speed: message.speed,
        };
    }

    return state;
}

export function shouldEmitTelemetryFrame(state: TelemetryClientState, nowMs: number): boolean {
    const minIntervalMs = SPEED_INTERVAL_MS[state.speed];
    return nowMs - state.lastFrameAt >= minIntervalMs;
}

// Store a list of connections for one user if they open multiple tabs
export function addWebClient(userId: string, ws: WebSocket) {
    webClients.set(userId, ws);
    clientStates.set(ws, {
        userId,
        scope: null,
        paused: false,
        speed: '1x',
        topN: 5,
        lastFrameAt: 0,
    });
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

                ws.on('message', async (data, isBinary) => {
                    if (isBinary) return;
                    try {
                        const payload = JSON.parse(data.toString());
                        if (payload.type === 'metrics') {
                            saveMetricsBatch(hostId, payload.metrics).catch(console.error);
                            const nowMs = Date.now();

                            await Promise.all(
                                Array.from(clientStates.entries()).map(async ([client, state]) => {
                                    if (!state.scope || state.paused) {
                                        return;
                                    }

                                    if (client.readyState !== WebSocket.OPEN || !shouldEmitTelemetryFrame(state, nowMs)) {
                                        return;
                                    }

                                    const frame = await buildTelemetryFrameFromLiveMetrics({
                                        scope: state.scope,
                                        hostId,
                                        metrics: payload.metrics,
                                        topN: state.topN,
                                    });

                                    if (!frame) {
                                        return;
                                    }

                                    clientStates.set(client, {
                                        ...state,
                                        lastFrameAt: nowMs,
                                    });

                                    client.send(
                                        JSON.stringify({
                                            type: 'metrics',
                                            scope: state.scope,
                                            aggregate: frame.aggregate,
                                            topContributors: frame.topContributors,
                                            restartIndicators: frame.aggregate.restartIndicators,
                                            generatedAt: new Date(nowMs).toISOString(),
                                        })
                                    );
                                })
                            );
                        } else if (payload.type === 'logs') {
                            saveLogsBatch(hostId, payload.logs).catch(console.error);
                            // Relay to web clients
                            webClients.forEach(client => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(data.toString());
                                }
                            });
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

                ws.on('message', async (data, isBinary) => {
                    if (isBinary) {
                        return;
                    }

                    try {
                        const parsedPayload = JSON.parse(data.toString());
                        const subscribeMessage = parseTelemetrySubscribeMessage(parsedPayload);
                        if (subscribeMessage) {
                            const scope = await resolveTelemetryScopeForUser({
                                userId: session.userId,
                                organizationId: subscribeMessage.organizationId,
                                projectId: subscribeMessage.projectId,
                                hostId: subscribeMessage.hostId,
                                containerId: subscribeMessage.containerId,
                            });

                            if (!scope) {
                                ws.send(JSON.stringify({
                                    type: 'metrics.subscribe.error',
                                    error: 'Requested telemetry scope is out of bounds',
                                }));
                                return;
                            }

                            const currentState = clientStates.get(ws);
                            if (!currentState) {
                                return;
                            }

                            clientStates.set(ws, {
                                ...currentState,
                                scope,
                                topN: coerceTopN(subscribeMessage.topN),
                            });

                            ws.send(JSON.stringify({
                                type: 'metrics.subscribe.ack',
                                scope,
                                topN: coerceTopN(subscribeMessage.topN),
                            }));
                            return;
                        }

                        const controlMessage = parseTelemetryControlMessage(parsedPayload);
                        if (controlMessage) {
                            const currentState = clientStates.get(ws);
                            if (!currentState) {
                                return;
                            }

                            const nextState = applyTelemetryControl(currentState, controlMessage);
                            clientStates.set(ws, nextState);

                            ws.send(JSON.stringify({
                                type: 'metrics.control.ack',
                                paused: nextState.paused,
                                speed: nextState.speed,
                            }));
                        }
                    } catch (err) {
                        ws.send(JSON.stringify({
                            type: 'metrics.control.error',
                            error: 'Invalid websocket control payload',
                        }));
                        console.error('Failed to parse WS message from client:', err);
                    }
                });

                // Keepalive
                const interval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    }
                }, 30000);

                ws.on('close', () => {
                    clearInterval(interval);
                    clientStates.delete(ws);
                    if (webClients.get(session.userId) === ws) {
                        webClients.delete(session.userId);
                    }
                });

                wss.emit('connection', ws, req, { type: 'client', id: session.userId });
            });
        });
    } else {
        socket.destroy();
    }
}
