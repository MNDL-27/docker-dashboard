'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    buildTelemetryControlMessage,
    buildTelemetrySubscribeMessage,
    createTelemetrySocket,
    fetchLiveTelemetrySnapshot,
    fetchTelemetryHistory,
    parseTelemetrySocketMessage,
    TELEMETRY_DEFAULT_TOP_N,
    TelemetryContributor,
    TelemetryFrameAggregate,
    TelemetryHistoryWindow,
    TelemetrySpeedPreset,
    TelemetryTrendPoint,
} from '@/lib/api';
import { TelemetryControls } from './TelemetryControls';
import { TopContributorsList } from './TopContributorsList';

interface TelemetryKpiPanelProps {
    organizationId: string;
    projectId?: string;
    hostId?: string | null;
    containerId?: string | null;
    selectedContainerId?: string | null;
    onSelectContainer?: (containerId: string) => void;
}

type TelemetryStateLabel = 'Live' | 'Paused' | 'Stale' | 'No data';

const FRESHNESS_STALE_MS = 15_000;
const FRESHNESS_NO_DATA_MS = 60_000;

function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
}

function formatBytes(value: number): string {
    if (value <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }

    const precision = size >= 10 || unit === 0 ? 0 : 1;
    return `${size.toFixed(precision)} ${units[unit]}`;
}

function stateBadgeClass(label: TelemetryStateLabel): string {
    if (label === 'Live') {
        return 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/50';
    }
    if (label === 'Paused') {
        return 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/50';
    }
    if (label === 'Stale') {
        return 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/50';
    }
    return 'bg-slate-700 text-slate-200 ring-1 ring-slate-600';
}

function metricTrend(trend: TelemetryTrendPoint[], metric: 'cpu' | 'memory' | 'network'): number[] {
    const points = trend.map((point) => {
        if (metric === 'cpu') {
            return point.cpuUsagePercentAvg;
        }
        if (metric === 'memory') {
            return point.memoryUsageBytesAvg;
        }
        return point.networkRxBytesMax + point.networkTxBytesMax;
    });

    return points.slice(-18);
}

function MiniTrend({ values }: { values: number[] }) {
    if (values.length === 0) {
        return <div className="h-8 rounded-md bg-slate-900/70" />;
    }

    const max = Math.max(...values, 1);

    return (
        <div className="flex h-8 items-end gap-0.5">
            {values.map((value, index) => (
                <span
                    key={`${index}-${value}`}
                    className="w-full rounded-sm bg-blue-400/60"
                    style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
                />
            ))}
        </div>
    );
}

interface KpiCardProps {
    title: string;
    value: string;
    detail: string;
    stateLabel: TelemetryStateLabel;
    trendValues: number[];
}

function KpiCard({ title, value, detail, stateLabel, trendValues }: KpiCardProps) {
    return (
        <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${stateBadgeClass(stateLabel)}`}>
                    {stateLabel}
                </span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{value}</div>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
            <div className="mt-3">
                <MiniTrend values={trendValues} />
            </div>
        </article>
    );
}

export function TelemetryKpiPanel({
    organizationId,
    projectId,
    hostId,
    containerId,
    selectedContainerId,
    onSelectContainer,
}: TelemetryKpiPanelProps) {
    const [windowPreset, setWindowPreset] = useState<TelemetryHistoryWindow>('1h');
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState<TelemetrySpeedPreset>('1x');
    const [loading, setLoading] = useState(true);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [aggregate, setAggregate] = useState<TelemetryFrameAggregate | null>(null);
    const [topContributors, setTopContributors] = useState<TelemetryContributor[]>([]);
    const [trend, setTrend] = useState<TelemetryTrendPoint[]>([]);
    const [activeTopN, setActiveTopN] = useState(TELEMETRY_DEFAULT_TOP_N);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [freshnessTick, setFreshnessTick] = useState(Date.now());
    const socketRef = useRef<WebSocket | null>(null);

    const scope = useMemo(
        () => ({
            organizationId,
            projectId,
            hostId: hostId ?? undefined,
            containerId: containerId ?? undefined,
        }),
        [organizationId, projectId, hostId, containerId]
    );

    useEffect(() => {
        const interval = window.setInterval(() => {
            setFreshnessTick(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadHistoryAndSnapshot() {
            setLoading(true);
            try {
                const [history, live] = await Promise.all([
                    fetchTelemetryHistory({
                        ...scope,
                        window: windowPreset,
                        topN: activeTopN,
                    }),
                    fetchLiveTelemetrySnapshot({
                        ...scope,
                        window: windowPreset,
                        topN: activeTopN,
                    }),
                ]);

                if (cancelled) {
                    return;
                }

                setTrend(history.trend);
                setAggregate(live.aggregate);
                setTopContributors(live.topContributors);
                setLastUpdatedAt(live.generatedAt);
                setStreamError(null);
            } catch (error) {
                if (!cancelled) {
                    setStreamError(error instanceof Error ? error.message : 'Failed to load telemetry history');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadHistoryAndSnapshot();

        return () => {
            cancelled = true;
        };
    }, [scope, windowPreset, activeTopN]);

    useEffect(() => {
        const socket = createTelemetrySocket();
        socketRef.current = socket;

        socket.onopen = () => {
            setStreamError(null);
            socket.send(JSON.stringify(buildTelemetrySubscribeMessage({ ...scope, window: windowPreset, topN: activeTopN })));
        };

        socket.onmessage = (event) => {
            const parsed = parseTelemetrySocketMessage(event.data);
            if (!parsed) {
                return;
            }

            if (parsed.type === 'metrics.subscribe.ack') {
                setActiveTopN(parsed.topN);
                return;
            }

            if (parsed.type === 'metrics.control.ack') {
                setPaused(parsed.paused);
                setSpeed(parsed.speed);
                return;
            }

            if (parsed.type === 'metrics.subscribe.error' || parsed.type === 'metrics.control.error') {
                setStreamError(parsed.error);
                return;
            }

            if (parsed.type === 'metrics') {
                setAggregate(parsed.aggregate);
                setTopContributors(parsed.topContributors);
                setLastUpdatedAt(parsed.generatedAt);
            }
        };

        socket.onerror = () => {
            setStreamError('Live telemetry socket is unavailable right now.');
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
    }, [scope, windowPreset, activeTopN]);

    const stateLabel: TelemetryStateLabel = useMemo(() => {
        if (paused) {
            return 'Paused';
        }

        if (!lastUpdatedAt) {
            return 'No data';
        }

        const elapsed = freshnessTick - new Date(lastUpdatedAt).getTime();
        if (elapsed >= FRESHNESS_NO_DATA_MS) {
            return 'No data';
        }
        if (elapsed >= FRESHNESS_STALE_MS) {
            return 'Stale';
        }
        return 'Live';
    }, [paused, lastUpdatedAt, freshnessTick]);

    const cpuTrend = useMemo(() => metricTrend(trend, 'cpu'), [trend]);
    const memoryTrend = useMemo(() => metricTrend(trend, 'memory'), [trend]);
    const networkTrend = useMemo(() => metricTrend(trend, 'network'), [trend]);

    const current =
        aggregate ??
        ({
            containerCount: 0,
            cpuUsagePercentAvg: 0,
            memoryUsageBytesAvg: 0,
            networkRxBytesMax: 0,
            networkTxBytesMax: 0,
            restartIndicators: {
                restartingNow: 0,
                containersWithRestarts: 0,
            },
        } satisfies TelemetryFrameAggregate);

    function sendControl(action: 'pause' | 'resume' | 'set-speed', nextSpeed?: TelemetrySpeedPreset) {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        const payload =
            action === 'set-speed' && nextSpeed
                ? buildTelemetryControlMessage(action, nextSpeed)
                : buildTelemetryControlMessage(action as 'pause' | 'resume');

        socket.send(JSON.stringify(payload));
    }

    return (
        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-100">Fleet telemetry</h2>
                    <p className="text-sm text-slate-400">
                        KPI-first live metrics for CPU, memory, network, and restart health in the active inventory scope.
                    </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateBadgeClass(stateLabel)}`}>
                    {stateLabel}
                </span>
            </div>

            <TelemetryControls
                windowPreset={windowPreset}
                paused={paused}
                speed={speed}
                onWindowChange={setWindowPreset}
                onTogglePause={() => {
                    sendControl(paused ? 'resume' : 'pause');
                }}
                onSpeedChange={(nextSpeed) => {
                    sendControl('set-speed', nextSpeed);
                }}
            />

            {streamError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {streamError}
                </div>
            ) : null}

            {loading ? <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">Loading telemetry...</div> : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    title="CPU"
                    value={formatPercent(current.cpuUsagePercentAvg)}
                    detail={`${current.containerCount} container${current.containerCount === 1 ? '' : 's'} in scope`}
                    stateLabel={stateLabel}
                    trendValues={cpuTrend}
                />
                <KpiCard
                    title="Memory"
                    value={formatBytes(current.memoryUsageBytesAvg)}
                    detail="Average working set"
                    stateLabel={stateLabel}
                    trendValues={memoryTrend}
                />
                <KpiCard
                    title="Network"
                    value={`${formatBytes(current.networkRxBytesMax)} / ${formatBytes(current.networkTxBytesMax)}`}
                    detail="RX / TX max in current window"
                    stateLabel={stateLabel}
                    trendValues={networkTrend}
                />
                <KpiCard
                    title="Restarts"
                    value={`${current.restartIndicators.restartingNow}`}
                    detail={`${current.restartIndicators.containersWithRestarts} containers with restart history`}
                    stateLabel={stateLabel}
                    trendValues={cpuTrend}
                />
            </div>

            <TopContributorsList
                contributors={topContributors}
                selectedContainerId={selectedContainerId}
                onSelectContainer={onSelectContainer}
            />
        </section>
    );
}
