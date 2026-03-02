'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    apiFetch,
    fetchOrganizations,
    getSelectedOrganizationId,
    OrganizationSummary,
    setSelectedOrganizationId,
} from '@/lib/api';
import { AddHostDialog } from '@/components/fleet/AddHostDialog';
import { HostList } from '@/components/fleet/HostList';

interface ProjectSummary {
    id: string;
    name: string;
    _count: {
        hosts: number;
        webhooks: number;
        alertRules: number;
    };
    firingAlerts: number;
}

export default function FleetPage() {
    const router = useRouter();
    const [orgId, setOrgId] = useState<string | null>(null);
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [scopeMessage, setScopeMessage] = useState<string | null>(null);
    const [showAddHost, setShowAddHost] = useState(false);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchOrganizations()
            .then((availableOrganizations) => {
                if (!availableOrganizations.length) {
                    router.replace('/onboarding/organization');
                    return;
                }

                setOrganizations(availableOrganizations);

                const storedOrganizationId = getSelectedOrganizationId();
                const selectedOrganization = storedOrganizationId
                    ? availableOrganizations.find((organization) => organization.id === storedOrganizationId)
                    : null;
                const activeOrganizationId = selectedOrganization?.id ?? availableOrganizations[0].id;

                setSelectedOrganizationId(activeOrganizationId);
                setOrgId(activeOrganizationId);
            })
            .catch(() => {
                router.replace('/login');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [router]);

    useEffect(() => {
        if (!orgId) return;
        fetchProjects(orgId);
    }, [orgId]);

    async function fetchProjects(currentOrganizationId: string) {
        try {
            setScopeMessage(null);
            const data = await apiFetch<{ projects: ProjectSummary[] }>(`/api/organizations/${currentOrganizationId}/projects`);
            setProjects(data.projects);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch projects';
            setProjects([]);
            setScopeMessage(
                message.includes('Not a member') || message.includes('Insufficient permissions')
                    ? 'Your current organization scope is unavailable. Switch organizations or contact an owner/admin for access.'
                    : message
            );
        }
    }

    async function handleCreateProject(e: React.FormEvent) {
        e.preventDefault();
        if (!newProjectName || !orgId) return;
        setCreating(true);
        try {
            await apiFetch(`/api/organizations/${orgId}/projects`, {
                method: 'POST',
                body: { name: newProjectName },
            });
            setNewProjectName('');
            setShowCreateProject(false);
            await fetchProjects(orgId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create project';
            setScopeMessage(
                message.includes('Insufficient permissions')
                    ? 'Project creation is blocked by your role in this organization. Ask an owner/admin for elevated access.'
                    : message
            );
        } finally {
            setCreating(false);
        }
    }

    function handleOrganizationChange(nextOrgId: string) {
        setSelectedOrganizationId(nextOrgId);
        setOrgId(nextOrgId);
    }

    if (loading) {
        return <div className="p-8 text-slate-400 font-medium">Loading dashboard...</div>;
    }

    if (!orgId) {
        return (
            <div className="p-8">
                <h2 className="text-slate-200 text-xl font-semibold">No Organization Found</h2>
                <p className="text-slate-500 mt-2">You must belong to an organization to view the dashboard.</p>
            </div>
        );
    }

    const totalHosts = projects.reduce((sum, p) => sum + p._count.hosts, 0);
    const totalFiring = projects.reduce((sum, p) => sum + p.firingAlerts, 0);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Dashboard</h1>
                    <p className="text-slate-400 text-sm">
                        {projects.length} client{projects.length !== 1 ? 's' : ''} · {totalHosts} host{totalHosts !== 1 ? 's' : ''} · {totalFiring} firing alert{totalFiring !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={orgId ?? ''}
                        onChange={(event) => handleOrganizationChange(event.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-sm"
                    >
                        {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                                {organization.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowAddHost(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors border border-slate-700"
                    >
                        + Add Host
                    </button>
                    <button
                        onClick={() => setShowCreateProject(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        + Add Client
                    </button>
                </div>
            </div>

            {scopeMessage && (
                <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {scopeMessage}
                </div>
            )}

            {/* Create Project Dialog */}
            {showCreateProject && (
                <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Create Client Workspace</h3>
                    <form onSubmit={handleCreateProject} className="flex gap-3">
                        <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Client name (e.g. Acme Corp)"
                            required
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={creating}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCreateProject(false)}
                            className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Project Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                    <div
                        key={project.id}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-5 cursor-pointer hover:border-slate-600 hover:bg-slate-800/50 transition-all group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                                {project.name}
                            </h3>
                            {project.firingAlerts > 0 && (
                                <span className="flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {project.firingAlerts} firing
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <div className="text-xl font-bold text-slate-200">{project._count.hosts}</div>
                                <div className="text-xs text-slate-500">Hosts</div>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-slate-200">{project._count.webhooks}</div>
                                <div className="text-xs text-slate-500">Webhooks</div>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-slate-200">{project._count.alertRules}</div>
                                <div className="text-xs text-slate-500">Rules</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {projects.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 border-dashed rounded-lg p-12 text-center">
                    <div className="text-slate-400 text-lg mb-2">No clients yet</div>
                    <div className="text-slate-600 text-sm mb-4">
                        Create your first client workspace to start enrolling hosts.
                    </div>
                    <button
                        onClick={() => setShowCreateProject(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        + Create First Client
                    </button>
                </div>
            )}

            {/* Host List - Fleet Inventory */}
            <HostList organizationId={orgId} />

            {showAddHost && (
                <AddHostDialog
                    organizationId={orgId}
                    projects={projects.map(p => ({ id: p.id, name: p.name }))}
                    onClose={() => {
                        setShowAddHost(false);
                        if (orgId) {
                            fetchProjects(orgId);
                        }
                    }}
                />
            )}
        </div>
    );
}
