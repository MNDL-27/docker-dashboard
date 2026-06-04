'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    fetchOrganizations,
    getSelectedOrganizationId,
    setSelectedOrganizationId,
    OrganizationSummary,
    fetchTelemetryHistory,
    fetchLiveTelemetrySnapshot,
    TelemetryHistoryWindow,
    TELEMETRY_HISTORY_WINDOWS,
} from '@/lib/api';
import { MetricsChart, MetricData } from '@/components/observability/MetricsChart';

type TimeWindow = TelemetryHistoryWindow;

export default function MonitoringPage() {
    const router = useRouter();

    const [orgId, setOrgId] = useState<string | null>(null);
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
    const [selectedWindow, setSelectedWindow] = useState<TimeWindow>('1h');
    const [chartData, setChartData] = useState<MetricData[]>([]);
    const [loading, setLoading] = useState(true);
    const [bootstrapping, setBootstrapping] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Bootstrap: load organizations and select active org
    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            try {
                const availableOrganizations = await fetchOrganizations();

                if (cancelled) return;

                if (!availableOrganizations.length) {
                    router.replace('/onboarding/organization');
                    return;
                }

                setOrganizations(availableOrganizations);

                const storedOrgId = getSelectedOrganizationId();
                const selectedOrg = storedOrgId
                    ? availableOrganizations.find((o) => o.id === storedOrgId)
                    : null;
                const activeOrgId = selectedOrg?.id ?? availableOrganizations[0].id;

                setSelectedOrganizationId(activeOrgId);
                setOrgId(activeOrgId);
            } catch {
                if (!cancelled) {
                    router.replace('/login');
                }
            } finally {
                if (!cancelled) {
                    setBootstrapping(false);
                }
            }
        }

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // Fetch telemetry when orgId or window changes
    useEffect(() => {
        if (!orgId || bootstrapping) return;

        let cancelled = false;

        async function loadMetrics() {
            try {
                setLoading(true);
                setError(null);

                const [history, live] = await Promise.all([
                    fetchTelemetryHistory({
                        organizationId: orgId,
                        window: selectedWindow,
                        topN: 5,
                    }),
                    fetchLiveTelemetrySnapshot({
                        organizationId: orgId,
                        window: selectedWindow,
                        topN: 5,
                    }),
                ]);

                if (cancelled) return;

                // Append live snapshot to history trend for continuous chart
                const historyData: MetricData[] = history.trend.map((point) => ({
                    timestamp: point.timestamp,
                    cpuUsagePercent: point.cpuUsagePercentAvg,
                    memoryUsageBytes: point.memoryUsageBytesAvg,
                    networkRxBytes: point.networkRxBytesMax,
                    networkTxBytes: point.networkTxBytesMax,
                }));

                const livePoint: MetricData = {
                    timestamp: live.generatedAt,
                    cpuUsagePercent: live.aggregate.cpuUsagePercentAvg,
                    memoryUsageBytes: live.aggregate.memoryUsageBytesAvg,
                    networkRxBytes: live.aggregate.networkRxBytesMax,
                    networkTxBytes: live.aggregate.networkTxBytesMax,
                };

                setChartData([...historyData, livePoint]);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load metrics');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadMetrics();

        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgId, selectedWindow, bootstrapping]);

    function handleOrganizationChange(nextOrgId: string) {
        setSelectedOrganizationId(nextOrgId);
        setOrgId(nextOrgId);
    }

    if (bootstrapping) {
        return (
            <div className="flex h-64 items-center justify-center">
                <span className="text-slate-400 text-sm">Loading monitoring dashboard...</span>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-1">Monitoring</h1>
                    <p className="text-slate-400 text-sm">
                        Fleet-wide CPU, memory, and network usage charts with historical context.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {organizations.length > 1 && (
                        <select
                            value={orgId ?? ''}
                            onChange={(e) => handleOrganizationChange(e.target.value)}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm"
                        >
                            {organizations.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <div className="flex gap-1">
                        {TELEMETRY_HISTORY_WINDOWS.map((w) => (
                            <button
                                key={w}
                                onClick={() => setSelectedWindow(w)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                    selectedWindow === w
                                        ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-500/60'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                </div>
            )}

            {/* Loading state */}
            {loading && chartData.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
                    Loading metrics...
                </div>
            )}

            {/* CPU chart — full width */}
            {!loading || chartData.length > 0 ? (
                <MetricsChart data={chartData} type="cpu" />
            ) : null}

            {/* Memory + Network — side by side */}
            {!loading || chartData.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                    <MetricsChart data={chartData} type="memory" />
                    <MetricsChart data={chartData} type="network" />
                </div>
            ) : null}

            {/* Empty state */}
            {!loading && chartData.length === 0 && !error && (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
                    <div className="text-slate-400 text-base mb-2">No telemetry data yet</div>
                    <div className="text-slate-600 text-sm">
                        Enroll hosts and containers to see fleet metrics here.
                    </div>
                </div>
            )}
        </div>
    );
}