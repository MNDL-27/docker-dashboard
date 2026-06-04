'use client';

import { useEffect, useRef, useState } from 'react';
import {
    createTelemetrySocket,
    buildTelemetrySubscribeMessage,
    parseTelemetrySocketMessage,
    TelemetryFrameAggregate,
    TelemetryContributor,
    TelemetryTrendPoint,
    TelemetryHistoryWindow,
    TelemetrySubscribeAckMessage,
    TelemetryMetricsFrameMessage,
} from '@/lib/api';

const TELEMETRY_WINDOWS: TelemetryHistoryWindow[] = ['15m', '1h', '6h', '24h'];
const DEFAULT_WINDOW: TelemetryHistoryWindow = '1h';

export interface FleetMetrics {
    aggregate: TelemetryFrameAggregate;
    topContributors: TelemetryContributor[];
    trend: TelemetryTrendPoint[];
    window: TelemetryHistoryWindow;
    topN: number;
}

export interface UseFleetMetricsOptions {
    organizationId: string;
    projectId?: string;
    hostId?: string;
    containerId?: string;
    window?: TelemetryHistoryWindow;
    topN?: number;
}

export interface UseFleetMetricsReturn {
    metrics: FleetMetrics | null;
    loading: boolean;
    error: string | null;
    window: TelemetryHistoryWindow;
    setWindow: (window: TelemetryHistoryWindow) => void;
    topN: number;
}

export function useFleetMetrics({
    organizationId,
    projectId,
    hostId,
    containerId,
    window: initialWindow = DEFAULT_WINDOW,
    topN: initialTopN = 5,
}: UseFleetMetricsOptions): UseFleetMetricsReturn {
    const [window, setWindow] = useState<TelemetryHistoryWindow>(initialWindow);
    const [topN, setTopN] = useState(initialTopN);
    const [metrics, setMetrics] = useState<FleetMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const trendRef = useRef<TelemetryTrendPoint[]>([]);
    const socketRef = useRef<WebSocket | null>(null);

    // Reset trend when window changes
    useEffect(() => {
        trendRef.current = [];
    }, [window]);

    useEffect(() => {
        if (!organizationId) return;

        const socket = createTelemetrySocket();
        socketRef.current = socket;

        socket.onopen = () => {
            setLoading(true);
            setError(null);
            socket.send(
                JSON.stringify(
                    buildTelemetrySubscribeMessage({
                        organizationId,
                        projectId,
                        hostId,
                        containerId,
                        window,
                        topN,
                    })
                )
            );
        };

        socket.onmessage = (event) => {
            const parsed = parseTelemetrySocketMessage(event.data);
            if (!parsed) return;

            if (parsed.type === 'metrics.subscribe.ack') {
                const ack = parsed as TelemetrySubscribeAckMessage;
                setLoading(false);
                setTopN(ack.topN);
                // Ack means subscription is active, but we need live frame to populate metrics
                return;
            }

            if (parsed.type === 'metrics') {
                const frame = parsed as TelemetryMetricsFrameMessage;
                const point: TelemetryTrendPoint = {
                    timestamp: frame.generatedAt,
                    cpuUsagePercentAvg: frame.aggregate.cpuUsagePercentAvg,
                    memoryUsageBytesAvg: frame.aggregate.memoryUsageBytesAvg,
                    networkRxBytesMax: frame.aggregate.networkRxBytesMax,
                    networkTxBytesMax: frame.aggregate.networkTxBytesMax,
                };

                trendRef.current = [...trendRef.current.slice(-49), point];

                setMetrics({
                    aggregate: frame.aggregate,
                    topContributors: frame.topContributors,
                    trend: trendRef.current,
                    window,
                    topN,
                });
                return;
            }

            if (
                parsed.type === 'metrics.subscribe.error' ||
                parsed.type === 'metrics.control.error'
            ) {
                setError(parsed.error);
                setLoading(false);
                return;
            }
        };

        socket.onerror = () => {
            setError('Live telemetry socket unavailable');
            setLoading(false);
        };

        socket.onclose = () => {
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };

        return () => {
            socket.close();
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [organizationId, projectId, hostId, containerId, window, topN]);

    return {
        metrics,
        loading,
        error,
        window,
        setWindow,
        topN,
    };
}

export { TELEMETRY_WINDOWS };