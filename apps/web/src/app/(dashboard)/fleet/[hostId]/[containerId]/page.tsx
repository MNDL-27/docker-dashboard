'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MetricsChart, { MetricData } from '@/components/observability/MetricsChart';
import LogStream, { LogEntry } from '@/components/observability/LogStream';
import ActionMenu from '@/components/observability/ActionMenu';
import { apiFetch } from '@/lib/api';

interface Container {
    id: string;
    dockerId: string;
    name: string;
    image: string;
    state: string;
    status: string;
    ports: any;
    startedAt: string | null;
}

export default function ContainerDetailPage({ params }: { params: Promise<{ hostId: string, containerId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const { hostId, containerId } = resolvedParams;

    const [container, setContainer] = useState<Container | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [metrics, setMetrics] = useState<MetricData[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

    // Fetch container details (simulated from host containers list for MVP)
    useEffect(() => {
        async function fetchContainer() {
            try {
                const data = await apiFetch<{ containers: Container[] }>(`/api/hosts/${hostId}/containers`);
                const found = data.containers.find(c => c.id === containerId || c.dockerId === containerId);
                if (found) {
                    setContainer(found);
                } else {
                    setError('Container not found');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load container data');
            } finally {
                setLoading(false);
            }
        }
        fetchContainer();
    }, [hostId, containerId]);

    // WebSocket connection for real-time data
    useEffect(() => {
        if (!container) return;

        // In development, API is typically on port 3001
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/client';

        let ws: WebSocket;

        const connectWs = () => {
            setWsStatus('connecting');
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setWsStatus('connected');
                // Could send a subscribe message here: ws.send(JSON.stringify({ action: 'subscribe', containerId: container.dockerId }));
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);

                    if (payload.type === 'metrics' && payload.metrics) {
                        // Filter metrics for this container if the backend broadcasts all
                        const relevantMetrics = payload.metrics.filter((m: any) => m.containerId === container.dockerId);
                        if (relevantMetrics.length > 0) {
                            setMetrics(prev => [...prev, ...relevantMetrics].slice(-60)); // Keep last 60 points (~5 mins)
                        }
                    } else if (payload.type === 'logs' && payload.logs) {
                        const relevantLogs = payload.logs.filter((l: any) => l.containerId === container.dockerId);
                        if (relevantLogs.length > 0) {
                            setLogs(prev => [...prev, ...relevantLogs].slice(-1000)); // Keep last 1000 lines
                        }
                    }
                } catch (e) {
                    console.error('WS parse error', e);
                }
            };

            ws.onclose = () => {
                setWsStatus('disconnected');
                // Optional: implement reconnect logic
            };
        };

        connectWs();

        return () => {
            if (ws) ws.close();
        };
    }, [container]);

    const handleContainerAction = async (action: 'START' | 'STOP' | 'RESTART', reason: string) => {
        if (!container) return;

        try {
            await apiFetch(`/api/containers/${container.dockerId}/actions`, {
                method: 'POST',
                body: JSON.stringify({ action, reason })
            });

            // Optimistically update status - actual update will come from next polling interval
            setContainer(prev => {
                if (!prev) return prev;
                if (action === 'STOP') return { ...prev, state: 'exited' };
                if (action === 'START' || action === 'RESTART') return { ...prev, state: 'running' };
                return prev;
            });

            // Could add a success toast here
        } catch (err: any) {
            throw new Error(err.message || `Failed to ${action.toLowerCase()} container`);
        }
    };

    if (loading) return <div className="p-8 text-slate-400">Loading container...</div>;

    if (error || !container) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <Link href={`/fleet/${hostId}`} className="text-slate-500 hover:text-slate-300 font-medium text-sm mb-6 inline-block">
                    &larr; Back to Host
                </Link>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-red-400">
                    {error || 'Container not found'}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <Link href={`/fleet/${hostId}`} className="text-slate-500 hover:text-slate-300 font-medium text-sm inline-block">
                &larr; Back to Host
            </Link>

            {/* Header */}
            <header className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-slate-100 m-0">{container.name}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${container.state === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                            }`}>
                            {container.state.toUpperCase()}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${wsStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            wsStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            WS: {wsStatus.toUpperCase()}
                        </span>
                    </div>
                    <div className="text-sm text-slate-400 font-mono">
                        {container.image} • ID: {container.dockerId.substring(0, 12)}
                    </div>
                </div>
                <div className="flex gap-2">
                    <ActionMenu
                        containerId={container.dockerId}
                        state={container.state}
                        isProtected={false} // Would ideally check labels here
                        userRole="ADMIN" // Mocked, would come from auth context
                        onAction={handleContainerAction}
                    />
                </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                <MetricsChart data={metrics} type="cpu" />
                <MetricsChart data={metrics} type="memory" />
                <MetricsChart data={metrics} type="network" />
            </div>

            {/* Terminal */}
            <div className="mt-8">
                <LogStream logs={logs} containerName={container.name} />
            </div>
        </div>
    );
}
