'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface AlertItem {
    id: string;
    status: string;
    startedAt: string;
    resolvedAt: string | null;
    rule: {
        name: string;
        condition: string;
        threshold: number | null;
        duration: number;
    };
    container: {
        name: string;
        dockerId: string;
        image: string;
        host: {
            name: string;
        };
    };
}

export default function AlertsPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<{ organizations: Array<{ id: string }> }>('/api/organizations')
            .then(data => {
                if (data.organizations && data.organizations.length > 0) {
                    setOrgId(data.organizations[0].id);
                }
            })
            .catch(() => {
                router.replace('/login');
            });
    }, [router]);

    useEffect(() => {
        if (!orgId) return;

        async function fetchAlerts() {
            try {
                const data = await apiFetch<{ alerts: AlertItem[] }>('/api/alerts', {
                    headers: { 'x-organization-id': orgId! },
                });
                setAlerts(data.alerts);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch alerts');
            } finally {
                setLoading(false);
            }
        }

        fetchAlerts();
        const interval = setInterval(fetchAlerts, 15000);
        return () => clearInterval(interval);
    }, [orgId]);

    const firingAlerts = alerts.filter(a => a.status === 'FIRING');
    const resolvedAlerts = alerts.filter(a => a.status === 'RESOLVED');

    if (loading) {
        return <div className="p-8 text-slate-400 font-medium">Loading alerts...</div>;
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-red-400">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Alerts</h1>
                    <p className="text-slate-400 text-sm">Monitor container alerts across your fleet.</p>
                </div>
                <Link
                    href="/alerts/rules"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    Manage Rules
                </Link>
            </div>

            {/* Firing Alerts Section */}
            {firingAlerts.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Firing ({firingAlerts.length})
                    </h2>
                    <div className="grid gap-3">
                        {firingAlerts.map(alert => (
                            <div
                                key={alert.id}
                                className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 flex items-center justify-between"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                                            FIRING
                                        </span>
                                        <span className="text-slate-200 font-medium">{alert.rule.name}</span>
                                    </div>
                                    <div className="text-slate-400 text-sm">
                                        {alert.container.name} on {alert.container.host.name}
                                        <span className="mx-2 text-slate-600">•</span>
                                        {alert.rule.condition.replace(/_/g, ' ')}
                                        {alert.rule.threshold !== null && ` > ${alert.rule.threshold}`}
                                    </div>
                                </div>
                                <div className="text-slate-500 text-xs font-mono">
                                    Since {new Date(alert.startedAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {firingAlerts.length === 0 && (
                <div className="mb-8 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-6 text-center">
                    <div className="text-emerald-400 font-medium mb-1">All Clear</div>
                    <div className="text-slate-400 text-sm">No alerts are currently firing.</div>
                </div>
            )}

            {/* Resolved Alerts History */}
            <h2 className="text-lg font-semibold text-slate-300 mb-4">History</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Rule</th>
                                <th className="px-6 py-4">Container</th>
                                <th className="px-6 py-4">Host</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Started</th>
                                <th className="px-6 py-4">Resolved</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {resolvedAlerts.map(alert => (
                                <tr key={alert.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-200 font-medium">{alert.rule.name}</td>
                                    <td className="px-6 py-4 text-slate-300">{alert.container.name}</td>
                                    <td className="px-6 py-4 text-slate-400">{alert.container.host.name}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            RESOLVED
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                        {new Date(alert.startedAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                        {alert.resolvedAt
                                            ? new Date(alert.resolvedAt).toLocaleString()
                                            : '—'}
                                    </td>
                                </tr>
                            ))}
                            {resolvedAlerts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                        No resolved alerts yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
