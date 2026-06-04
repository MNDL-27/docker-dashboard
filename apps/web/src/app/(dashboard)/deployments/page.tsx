'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    fetchOrganizations,
    getSelectedOrganizationId,
    setSelectedOrganizationId,
    OrganizationSummary,
} from '@/lib/api';

type DeploymentStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

interface Deployment {
    id: string;
    version: string;
    status: DeploymentStatus;
    environment: string;
    startedAt: string;
    completedAt: string | null;
    hostCount: number;
    containerCount: number;
    initiatedBy: string;
}

interface DeploymentReadiness {
    label: string;
    description: string;
    ready: boolean;
}

const STATUS_LABELS: Record<DeploymentStatus, string> = {
    READY: 'Ready',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    ROLLED_BACK: 'Rolled Back',
};

function StatusBadge({ status }: { status: DeploymentStatus }) {
    const classes: Record<DeploymentStatus, string> = {
        READY: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        IN_PROGRESS: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        COMPLETED: 'text-slate-400 bg-slate-700/50 border-slate-600/30',
        FAILED: 'text-red-400 bg-red-500/10 border-red-500/30',
        ROLLED_BACK: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${classes[status]}`}>
            {status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            {STATUS_LABELS[status]}
        </span>
    );
}

export default function DeploymentsPage() {
    const router = useRouter();

    const [orgId, setOrgId] = useState<string | null>(null);
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
    const [bootstrapping, setBootstrapping] = useState(true);

    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [readiness, setReadiness] = useState<DeploymentReadiness[]>([
        { label: 'Hosts enrolled', description: 'At least one host must be enrolled and online', ready: false },
        { label: 'Alert rules configured', description: 'Define alert rules to monitor deployment health', ready: false },
        { label: 'Webhook endpoint set', description: 'Configure a webhook to receive deployment notifications', ready: false },
    ]);

    // Bootstrap
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
                if (!cancelled) router.replace('/login');
            } finally {
                if (!cancelled) setBootstrapping(false);
            }
        }

        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [router]);

    // Simulate loading deployment history
    useEffect(() => {
        if (!orgId || bootstrapping) return;

        setDeployments([]);
        setLoading(false);
    }, [orgId, bootstrapping]);

    function handleOrganizationChange(nextOrgId: string) {
        setSelectedOrganizationId(nextOrgId);
        setOrgId(nextOrgId);
    }

    if (bootstrapping) {
        return (
            <div className="flex h-64 items-center justify-center">
                <span className="text-slate-400 text-sm">Loading deployments...</span>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-1">Deployments</h1>
                    <p className="text-slate-400 text-sm">
                        Track deployment readiness and history across your fleet.
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
                </div>
            </div>

            {/* Deployment readiness panel */}
            <section className="glass-card">
                <h2 className="text-base font-semibold text-slate-100 mb-4">Deployment readiness</h2>
                <div className="space-y-3">
                    {readiness.map((item) => (
                        <div
                            key={item.label}
                            className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                        >
                            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                item.ready
                                    ? 'bg-emerald-500/20 ring-1 ring-emerald-500/60'
                                    : 'bg-slate-800 ring-1 ring-slate-700'
                            }`}>
                                {item.ready && (
                                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 12 12">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-200">{item.label}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                            </div>
                            <span className={`text-xs font-semibold shrink-0 ${item.ready ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {item.ready ? 'Ready' : 'Pending'}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-slate-600">●</span>
                    Complete all readiness checks before triggering a deployment
                </div>
            </section>

            {/* Deployment history */}
            <section className="glass-card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-slate-100">Deployment history</h2>
                </div>

                {loading ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
                        Loading deployment history...
                    </div>
                ) : error ? (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                ) : deployments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
                        <div className="text-slate-400 text-sm mb-1">No deployments yet</div>
                        <div className="text-slate-600 text-xs">
                            Deployment history will appear here once you trigger your first release.
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Version</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Environment</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Started</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Hosts</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Containers</th>
                                    <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {deployments.map((deployment) => (
                                    <tr key={deployment.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3 text-slate-200 font-mono text-xs">{deployment.version}</td>
                                        <td className="py-3 text-slate-400 text-xs">{deployment.environment}</td>
                                        <td className="py-3">
                                            <StatusBadge status={deployment.status} />
                                        </td>
                                        <td className="py-3 text-slate-400 font-mono text-xs">
                                            {new Date(deployment.startedAt).toLocaleString()}
                                        </td>
                                        <td className="py-3 text-slate-500 font-mono text-xs">
                                            {deployment.completedAt
                                                ? new Date(deployment.completedAt).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="py-3 text-slate-300 text-xs text-right">{deployment.hostCount}</td>
                                        <td className="py-3 text-slate-300 text-xs text-right">{deployment.containerCount}</td>
                                        <td className="py-3 text-slate-400 text-xs">{deployment.initiatedBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}