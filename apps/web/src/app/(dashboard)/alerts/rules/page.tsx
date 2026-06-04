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

interface Organization {
    id: string;
    name: string;
}

const CONDITION_OPTIONS = [
    { value: 'CONTAINER_DOWN', label: 'Container Down' },
    { value: 'RESTART_LOOP', label: 'Restart Loop' },
    { value: 'CPU_USAGE', label: 'CPU Usage (%)' },
    { value: 'MEMORY_USAGE', label: 'Memory Usage (bytes)' },
];

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatThreshold(condition: string, value: number | null): string {
    if (value === null) return '—';
    if (condition === 'CPU_USAGE') return `${value}%`;
    return formatBytes(value);
}

export default function AlertRulesPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formCondition, setFormCondition] = useState('CPU_USAGE');
    const [formThreshold, setFormThreshold] = useState('');
    const [formDuration, setFormDuration] = useState('5');
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        apiFetch<{ organizations: Organization[] }>('/api/organizations')
            .then(data => {
                if (cancelled) return;
                if (!data.organizations || data.organizations.length === 0) {
                    router.replace('/onboarding/organization');
                    return;
                }
                setOrganizations(data.organizations);
                const saved = localStorage.getItem('selectedOrgId');
                const match = saved && data.organizations.find(o => o.id === saved);
                setOrgId(match ? saved : data.organizations[0].id);
            })
            .catch(() => {
                if (!cancelled) router.replace('/login');
            });
        return () => { cancelled = true; };
    }, [router]);

    useEffect(() => {
        if (!orgId) return;
        localStorage.setItem('selectedOrgId', orgId);
        fetchRules();
    }, [orgId]);

    async function fetchRules() {
        setLoading(true);
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
            setFormCondition('CPU_USAGE');
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
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="glass-card flex items-center justify-center py-16">
                    <div className="text-slate-400 text-sm">Loading alert rules...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="glass-card border-red-500/30">
                    <div className="text-red-400 text-sm">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <style jsx>{`
                .glass-card {
                    background: rgba(30, 41, 59, 0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                    border-radius: 16px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }
                .glass-input {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.15);
                    border-radius: 10px;
                    color: rgba(248, 250, 252, 0.9);
                    font-size: 0.875rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    outline: none;
                }
                .glass-input:focus {
                    border-color: rgba(99, 102, 241, 0.6);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                }
                .glass-input::placeholder {
                    color: rgba(100, 116, 139, 0.7);
                }
                .glass-select {
                    background: rgba(15, 23, 42, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.15);
                    border-radius: 10px;
                    color: rgba(248, 250, 252, 0.9);
                    font-size: 0.875rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    outline: none;
                    cursor: pointer;
                }
                .glass-select:focus {
                    border-color: rgba(99, 102, 241, 0.6);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                }
            `}</style>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/alerts" className="text-slate-400 hover:text-slate-200 text-sm transition-colors">
                            ← Alerts
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Alert Rules</h1>
                    <p className="text-slate-400 text-sm">Configure conditions that trigger alerts across your fleet.</p>
                </div>
                <div className="flex items-center gap-3">
                    {organizations.length > 1 && (
                        <select
                            value={orgId ?? ''}
                            onChange={e => setOrgId(e.target.value)}
                            className="glass-select text-sm py-1.5 pr-8"
                            style={{ minWidth: 160 }}
                        >
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {showForm ? 'Cancel' : '+ New Rule'}
                    </button>
                </div>
            </div>

            {/* Create Rule Form */}
            {showForm && (
                <div className="glass-card p-6 mb-6">
                    <h3 className="text-base font-semibold text-slate-100 mb-5">Create Alert Rule</h3>
                    <form onSubmit={handleCreate} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Rule Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="e.g. High CPU Alert"
                                    required
                                    className="glass-input"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Condition</label>
                                <select
                                    value={formCondition}
                                    onChange={e => setFormCondition(e.target.value)}
                                    className="glass-select"
                                >
                                    {CONDITION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            {needsThreshold && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Threshold
                                    </label>
                                    <input
                                        type="number"
                                        value={formThreshold}
                                        onChange={e => setFormThreshold(e.target.value)}
                                        placeholder={formCondition === 'CPU_USAGE' ? '80' : '1073741824'}
                                        required={needsThreshold}
                                        step="any"
                                        className="glass-input"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Duration (minutes)</label>
                                <input
                                    type="number"
                                    value={formDuration}
                                    onChange={e => setFormDuration(e.target.value)}
                                    min="1"
                                    required
                                    className="glass-input"
                                />
                            </div>
                        </div>

                        {formError && (
                            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{formError}</div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={formSubmitting}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {formSubmitting ? 'Creating...' : 'Create Rule'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Rules Table */}
            <div className="glass-card overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-slate-800/60">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-300">Active Rules</h2>
                        <span className="text-xs text-slate-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-800/60">
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Condition</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Threshold</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Alerts</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                            {rules.map(rule => (
                                <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 text-slate-200 font-medium">{rule.name}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                            {rule.condition.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                                        {formatThreshold(rule.condition, rule.threshold)}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">{rule.duration} min</td>
                                    <td className="px-6 py-4">
                                        {rule._count.alerts > 0 ? (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                                                {rule._count.alerts}
                                            </span>
                                        ) : (
                                            <span className="text-slate-600 text-xs">0</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800/60 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="text-slate-300 text-sm font-medium mb-0.5">No alert rules configured</div>
                                                <div className="text-slate-500 text-xs">Click &quot;+ New Rule&quot; to define your first rule.</div>
                                            </div>
                                        </div>
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