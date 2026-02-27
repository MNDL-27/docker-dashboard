'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';

interface AuditLog {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    status: string;
    reason: string;
    timestamp: string;
    user?: {
        name: string | null;
        email: string;
    };
}

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchLogs() {
            try {
                const data = await apiFetch<{ logs: AuditLog[] }>('/api/audit');
                setLogs(data.logs);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch audit logs');
            } finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, []);

    if (loading) return <div className="p-8 text-slate-400 font-medium">Loading audit trail...</div>;

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
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Audit Trail</h1>
                    <p className="text-slate-400 text-sm">View all actions performed within your organization.</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Target Container</th>
                                <th className="px-6 py-4 min-w-[200px]">Reason</th>
                                <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-300 font-mono text-xs">
                                        {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-slate-200 font-medium">{log.user?.email || 'System'}</div>
                                        {log.user?.name && <div className="text-slate-500 text-xs">{log.user.name}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold
                      ${log.action === 'START' ? 'bg-emerald-500/10 text-emerald-400' :
                                                log.action === 'STOP' ? 'bg-red-500/10 text-red-400' :
                                                    'bg-amber-500/10 text-amber-400'}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                                        {log.targetId.substring(0, 12)}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {log.reason || <span className="text-slate-600 italic">None provided</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {log.status === 'SUCCESS' ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                            )}
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                        No actions have been audited yet.
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
