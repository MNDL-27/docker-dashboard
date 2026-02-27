'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface WebhookItem {
    id: string;
    url: string;
    secret: string | null;
    isActive: boolean;
    createdAt: string;
}

export default function WebhookSettingsPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formUrl, setFormUrl] = useState('');
    const [formSecret, setFormSecret] = useState('');
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
        fetchWebhooks();
    }, [orgId]);

    async function fetchWebhooks() {
        try {
            const data = await apiFetch<{ webhooks: WebhookItem[] }>('/api/webhooks', {
                headers: { 'x-organization-id': orgId! },
            });
            setWebhooks(data.webhooks);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch webhooks');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setFormSubmitting(true);
        setFormError(null);

        try {
            await apiFetch('/api/webhooks', {
                method: 'POST',
                headers: { 'x-organization-id': orgId! },
                body: {
                    url: formUrl,
                    secret: formSecret || null,
                },
            });

            setFormUrl('');
            setFormSecret('');
            setShowForm(false);
            fetchWebhooks();
        } catch (err: any) {
            setFormError(err.message || 'Failed to create webhook');
        } finally {
            setFormSubmitting(false);
        }
    }

    async function handleToggle(webhook: WebhookItem) {
        try {
            await apiFetch(`/api/webhooks/${webhook.id}`, {
                method: 'PUT',
                headers: { 'x-organization-id': orgId! },
                body: { isActive: !webhook.isActive },
            });
            fetchWebhooks();
        } catch (err: any) {
            alert(err.message || 'Failed to update webhook');
        }
    }

    async function handleDelete(webhookId: string) {
        if (!confirm('Delete this webhook?')) return;

        try {
            await apiFetch(`/api/webhooks/${webhookId}`, {
                method: 'DELETE',
                headers: { 'x-organization-id': orgId! },
            });
            fetchWebhooks();
        } catch (err: any) {
            alert(err.message || 'Failed to delete webhook');
        }
    }

    if (loading) {
        return <div className="p-8 text-slate-400 font-medium">Loading webhook settings...</div>;
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
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Webhook Settings</h1>
                    <p className="text-slate-400 text-sm">Configure webhook endpoints for alert notifications.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {showForm ? 'Cancel' : '+ Add Webhook'}
                </button>
            </div>

            {/* Create Webhook Form */}
            {showForm && (
                <div className="mb-8 bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Add Webhook Endpoint</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Webhook URL</label>
                            <input
                                type="url"
                                value={formUrl}
                                onChange={(e) => setFormUrl(e.target.value)}
                                placeholder="https://hooks.example.com/docker-alerts"
                                required
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Secret <span className="text-slate-600">(optional — for HMAC signature verification)</span>
                            </label>
                            <input
                                type="text"
                                value={formSecret}
                                onChange={(e) => setFormSecret(e.target.value)}
                                placeholder="Optional HMAC secret"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                            />
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
                                {formSubmitting ? 'Adding...' : 'Add Webhook'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Webhooks List */}
            <div className="space-y-3">
                {webhooks.map(webhook => (
                    <div
                        key={webhook.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${webhook.isActive
                                        ? 'text-emerald-400 bg-emerald-500/10'
                                        : 'text-slate-500 bg-slate-700/50'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${webhook.isActive ? 'bg-emerald-500' : 'bg-slate-600'
                                        }`} />
                                    {webhook.isActive ? 'Active' : 'Paused'}
                                </span>
                                <span className="text-slate-200 font-mono text-sm truncate">
                                    {webhook.url}
                                </span>
                            </div>
                            <div className="text-slate-500 text-xs">
                                Added {new Date(webhook.createdAt).toLocaleDateString()}
                                {webhook.secret && (
                                    <span className="ml-2 inline-flex items-center gap-1 text-amber-500/70">
                                        🔒 HMAC signed
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <button
                                onClick={() => handleToggle(webhook)}
                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${webhook.isActive
                                        ? 'text-amber-400 hover:bg-amber-500/10'
                                        : 'text-emerald-400 hover:bg-emerald-500/10'
                                    }`}
                            >
                                {webhook.isActive ? 'Pause' : 'Activate'}
                            </button>
                            <button
                                onClick={() => handleDelete(webhook.id)}
                                className="px-3 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}

                {webhooks.length === 0 && (
                    <div className="bg-slate-900 border border-slate-800 border-dashed rounded-lg p-8 text-center">
                        <div className="text-slate-500 mb-2">No webhooks configured</div>
                        <div className="text-slate-600 text-sm">
                            Add a webhook to receive alert notifications via HTTP POST.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
