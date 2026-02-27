'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

interface AlertRule {
    id: string;
    name: string;
    condition: string;
    threshold: number | null;
    duration: number;
    createdAt: string;
    _count: {
        alerts: number;
    };
}

const CONDITION_OPTIONS = [
    { value: 'CONTAINER_DOWN', label: 'Container Down' },
    { value: 'RESTART_LOOP', label: 'Restart Loop' },
    { value: 'CPU_USAGE', label: 'CPU Usage (%)' },
    { value: 'MEMORY_USAGE', label: 'Memory Usage (bytes)' },
];

export default function AlertRulesPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formCondition, setFormCondition] = useState('CONTAINER_DOWN');
    const [formThreshold, setFormThreshold] = useState('');
    const [formDuration, setFormDuration] = useState('5');
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

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
        fetchRules();
    }, [orgId]);

    async function fetchRules() {
        try {
            const data = await apiFetch<{ rules: AlertRule[] }>('/api/alerts/rules', {
                headers: { 'x-organization-id': orgId! },
            });
            setRules(data.rules);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch rules');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setFormSubmitting(true);
        setFormError(null);

        try {
            await apiFetch('/api/alerts/rules', {
                method: 'POST',
                headers: { 'x-organization-id': orgId! },
                body: {
                    name: formName,
                    condition: formCondition,
                    threshold: formThreshold ? parseFloat(formThreshold) : null,
                    duration: parseInt(formDuration, 10),
                },
            });

            setFormName('');
            setFormCondition('CONTAINER_DOWN');
            setFormThreshold('');
            setFormDuration('5');
            setShowForm(false);
            fetchRules();
        } catch (err: any) {
            setFormError(err.message || 'Failed to create rule');
        } finally {
            setFormSubmitting(false);
        }
    }

    async function handleDelete(ruleId: string) {
        if (!confirm('Delete this alert rule? All associated alerts will also be deleted.')) return;

        try {
            await apiFetch(`/api/alerts/rules/${ruleId}`, {
                method: 'DELETE',
                headers: { 'x-organization-id': orgId! },
            });
            fetchRules();
        } catch (err: any) {
            alert(err.message || 'Failed to delete rule');
        }
    }

    const needsThreshold = formCondition === 'CPU_USAGE' || formCondition === 'MEMORY_USAGE';

    if (loading) {
        return <div className="p-8 text-slate-400 font-medium">Loading alert rules...</div>;
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
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/alerts" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
                            ← Alerts
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Alert Rules</h1>
                    <p className="text-slate-400 text-sm">Configure conditions that trigger alerts.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {showForm ? 'Cancel' : '+ New Rule'}
                </button>
            </div>

            {/* Create Rule Form */}
            {showForm && (
                <div className="mb-8 bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Create Alert Rule</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Rule Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. High CPU Alert"
                                    required
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Condition</label>
                                <select
                                    value={formCondition}
                                    onChange={(e) => setFormCondition(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    {CONDITION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            {needsThreshold && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">
                                        Threshold {formCondition === 'CPU_USAGE' ? '(%)' : '(bytes)'}
                                    </label>
                                    <input
                                        type="number"
                                        value={formThreshold}
                                        onChange={(e) => setFormThreshold(e.target.value)}
                                        placeholder={formCondition === 'CPU_USAGE' ? '80' : '1073741824'}
                                        required={needsThreshold}
                                        step="any"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Duration (minutes)</label>
                                <input
                                    type="number"
                                    value={formDuration}
                                    onChange={(e) => setFormDuration(e.target.value)}
                                    min="1"
                                    required
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {formError && (
                            <div className="text-red-400 text-sm">{formError}</div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={formSubmitting}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {formSubmitting ? 'Creating...' : 'Create Rule'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Rules Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Condition</th>
                                <th className="px-6 py-4">Threshold</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Alerts</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {rules.map(rule => (
                                <tr key={rule.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-200 font-medium">{rule.name}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-slate-700/50 text-slate-300">
                                            {rule.condition.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                                        {rule.threshold !== null ? rule.threshold : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">{rule.duration} min</td>
                                    <td className="px-6 py-4 text-slate-400">{rule._count.alerts}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="px-3 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                                        No alert rules configured. Click &quot;+ New Rule&quot; to create one.
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
