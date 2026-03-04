import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { authenticateAgentWS } from './auth';
import { saveMetricsBatch } from '../services/metrics';
import {
    saveLogsBatch,
    getLogsRange,
    mapAgentLogsForScopedDelivery,
    resolveLogsScopeForUser,
    type LiveScopedLogLine,
    type LogsScope,
} from '../services/logs';
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

export type LogsReconnectMode = 'backfill' | 'now';
export type LogsStatus = 'Connected' | 'Reconnecting' | 'Paused';

export interface LogsClientState {
    userId: string;
    scope: LogsScope | null;
    paused: boolean;
    reconnectMode: LogsReconnectMode;
    status: LogsStatus;
    pendingCount: number;
    pendingBadge: string;
    pendingLines: Array<{
        containerId: string;
        stream: string;
        message: string;
        timestamp: string;
    }>;
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

type LogsSubscribeMessage = {
    type: 'logs.subscribe';
    organizationId: string;
    projectId?: string;
    hostId: string;
    containerId: string;
    mode?: LogsReconnectMode;
    since?: string;
    limit?: number;
};

type LogsControlMessage = {
    type: 'logs.control';
    action: 'pause' | 'resume' | 'set-mode';
    mode?: LogsReconnectMode;
};

const clientStates = new Map<WebSocket, TelemetryClientState>();
const logsClientStates = new Map<WebSocket, LogsClientState>();

function createLogsClientState(userId: string): LogsClientState {
    return {
        userId,
        scope: null,
        paused: false,
        reconnectMode: 'backfill',
        status: 'Connected',
        pendingCount: 0,
        pendingBadge: '0',
        pendingLines: [],
    };
}

export function formatPendingBadge(count: number): string {
    return count > 999 ? '999+' : String(count);
}

export function applyLogsControl(state: LogsClientState, message: LogsControlMessage): LogsClientState {
    if (message.action === 'pause') {
        return {
            ...state,
            paused: true,
            status: 'Paused',
        };
    }

    if (message.action === 'resume') {
        return {
            ...state,
            paused: false,
            status: 'Connected',
            pendingCount: 0,
            pendingBadge: '0',
            pendingLines: [],
        };
    }

    if (message.action === 'set-mode' && (message.mode === 'backfill' || message.mode === 'now')) {
        return {
            ...state,
            reconnectMode: message.mode,
        };
    }

    return state;
}

export function queuePausedLogs(state: LogsClientState, lines: LiveScopedLogLine[]): LogsClientState {
    const visibleLines = lines.map((line) => ({
        containerId: line.containerId,
        stream: line.stream,
        message: line.message,
        timestamp: line.timestamp,
    }));

    const pendingCount = state.pendingCount + visibleLines.length;
    const mergedPendingLines = [...state.pendingLines, ...visibleLines].slice(-1000);

    return {
        ...state,
        paused: true,
        status: 'Paused',
        pendingCount,
        pendingBadge: formatPendingBadge(pendingCount),
        pendingLines: mergedPendingLines,
    };
}

export function shouldDeliverLogLineToState(state: LogsClientState, line: LiveScopedLogLine): boolean {
    if (!state.scope) {
        return false;
    }

    if (state.scope.organizationId !== line.organizationId) {
        return false;
    }

    if (state.scope.projectId && state.scope.projectId !== line.projectId) {
        return false;
    }

    return state.scope.hostId === line.hostId && state.scope.containerId === line.containerId;
}

export function buildLogsSubscribeAck(state: LogsClientState) {
    return {
        type: 'logs.subscribe.ack' as const,
        scope: state.scope,
        mode: state.reconnectMode,
        status: state.status,
        pending: state.pendingCount,
        pendingBadge: state.pendingBadge,
    };
}

export function buildLogsControlAck(state: LogsClientState) {
    return {
        type: 'logs.control.ack' as const,
        paused: state.paused,
        mode: state.reconnectMode,
        status: state.status,
        pending: state.pendingCount,
        pendingBadge: state.pendingBadge,
    };
}

export function buildLogsStatus(state: LogsClientState) {
    return {
        type: 'logs.status' as const,
        status: state.status,
        pending: state.pendingCount,
        pendingBadge: state.pendingBadge,
    };
}

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

function parseLogsSubscribeMessage(payload: unknown): LogsSubscribeMessage | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (
        candidate.type !== 'logs.subscribe'
        || typeof candidate.organizationId !== 'string'
        || typeof candidate.hostId !== 'string'
        || typeof candidate.containerId !== 'string'
    ) {
        return null;
    }

    const mode = candidate.mode === 'now' ? 'now' : candidate.mode === 'backfill' ? 'backfill' : undefined;

    return {
        type: 'logs.subscribe',
        organizationId: candidate.organizationId,
        projectId: typeof candidate.projectId === 'string' ? candidate.projectId : undefined,
        hostId: candidate.hostId,
        containerId: candidate.containerId,
        mode,
        since: typeof candidate.since === 'string' ? candidate.since : undefined,
        limit: typeof candidate.limit === 'number' ? candidate.limit : undefined,
    };
}

function parseLogsControlMessage(payload: unknown): LogsControlMessage | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (candidate.type !== 'logs.control') {
        return null;
    }

    if (candidate.action !== 'pause' && candidate.action !== 'resume' && candidate.action !== 'set-mode') {
        return null;
    }

    return {
        type: 'logs.control',
        action: candidate.action,
        mode: candidate.mode === 'now' ? 'now' : candidate.mode === 'backfill' ? 'backfill' : undefined,
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
    logsClientStates.set(ws, createLogsClientState(userId));
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
                            const scopedLines = await mapAgentLogsForScopedDelivery(hostId, payload.logs);
                            if (scopedLines.length === 0) {
                                return;
                            }

                            for (const [client, state] of logsClientStates.entries()) {
                                if (client.readyState !== WebSocket.OPEN || !state.scope) {
                                    continue;
                                }

                                const deliverableLines = scopedLines
                                    .filter((line) => shouldDeliverLogLineToState(state, line))
                                    .map((line) => ({
                                        containerId: line.containerId,
                                        stream: line.stream,
                                        message: line.message,
                                        timestamp: line.timestamp,
                                    }));

                                if (deliverableLines.length === 0) {
                                    continue;
                                }

                                if (state.paused) {
                                    const queuedState = queuePausedLogs(
                                        state,
                                        scopedLines.filter((line) => shouldDeliverLogLineToState(state, line))
                                    );
                                    logsClientStates.set(client, queuedState);
                                    client.send(JSON.stringify({
                                        ...buildLogsStatus(queuedState),
                                    }));
                                    continue;
                                }

                                client.send(JSON.stringify({
                                    type: 'logs',
                                    scope: state.scope,
                                    lines: deliverableLines,
                                    status: 'Connected',
                                }));
                            }
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
                        const logsSubscribeMessage = parseLogsSubscribeMessage(parsedPayload);
                        if (logsSubscribeMessage) {
                            const logsScope = await resolveLogsScopeForUser({
                                userId: session.userId,
                                organizationId: logsSubscribeMessage.organizationId,
                                projectId: logsSubscribeMessage.projectId,
                                hostId: logsSubscribeMessage.hostId,
                                containerId: logsSubscribeMessage.containerId,
                            });

                            if (!logsScope) {
                                ws.send(JSON.stringify({
                                    type: 'logs.subscribe.error',
                                    error: 'Requested logs scope is out of bounds',
                                }));
                                return;
                            }

                            const currentLogsState = logsClientStates.get(ws);
                            if (!currentLogsState) {
                                return;
                            }

                            const reconnectMode = logsSubscribeMessage.mode ?? currentLogsState.reconnectMode;
                            let nextLogsState: LogsClientState = {
                                ...currentLogsState,
                                scope: logsScope,
                                reconnectMode,
                                paused: false,
                                status: 'Connected',
                                pendingCount: 0,
                                pendingBadge: '0',
                                pendingLines: [],
                            };

                            if (reconnectMode === 'backfill' && logsSubscribeMessage.since) {
                                nextLogsState = {
                                    ...nextLogsState,
                                    status: 'Reconnecting',
                                };
                                logsClientStates.set(ws, nextLogsState);

                                ws.send(JSON.stringify({
                                    ...buildLogsStatus(nextLogsState),
                                }));

                                const replay = await getLogsRange({
                                    scope: logsScope,
                                    start: logsSubscribeMessage.since,
                                    end: new Date().toISOString(),
                                    limit: logsSubscribeMessage.limit,
                                });

                                if (replay.lines.length > 0) {
                                    ws.send(JSON.stringify({
                                        type: 'logs',
                                        scope: logsScope,
                                        lines: replay.lines,
                                        source: 'backfill',
                                        retention: replay.metadata,
                                    }));
                                }

                                nextLogsState = {
                                    ...nextLogsState,
                                    status: 'Connected',
                                };
                            }

                            logsClientStates.set(ws, nextLogsState);

                            ws.send(JSON.stringify({
                                ...buildLogsSubscribeAck(nextLogsState),
                            }));

                            ws.send(JSON.stringify({
                                ...buildLogsStatus(nextLogsState),
                            }));
                            return;
                        }

                        const logsControlMessage = parseLogsControlMessage(parsedPayload);
                        if (logsControlMessage) {
                            const currentLogsState = logsClientStates.get(ws);
                            if (!currentLogsState) {
                                return;
                            }

                            const linesToFlush =
                                logsControlMessage.action === 'resume' && currentLogsState.pendingLines.length > 0
                                    ? currentLogsState.pendingLines
                                    : [];

                            const nextLogsState = applyLogsControl(currentLogsState, logsControlMessage);
                            logsClientStates.set(ws, nextLogsState);

                            if (linesToFlush.length > 0 && nextLogsState.scope) {
                                ws.send(JSON.stringify({
                                    type: 'logs',
                                    scope: nextLogsState.scope,
                                    lines: linesToFlush,
                                    source: 'pending',
                                }));
                            }

                            ws.send(JSON.stringify({
                                ...buildLogsControlAck(nextLogsState),
                            }));

                            ws.send(JSON.stringify({
                                ...buildLogsStatus(nextLogsState),
                            }));
                            return;
                        }

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
                    logsClientStates.delete(ws);
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
