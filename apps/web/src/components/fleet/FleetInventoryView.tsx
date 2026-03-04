'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    fetchFleetInventory,
    fetchHostContainers,
    FleetContainerSummary,
    FleetHostSummary,
    getInventoryDensityPreference,
    InventoryFilters,
    InventoryDensity,
} from '@/lib/api';
import { ContainerCardGrid } from './ContainerCardGrid';
import { FleetFilters } from './FleetFilters';
import { HostCard } from './HostCard';

interface FleetInventoryViewProps {
    organizationId: string;
}

const DEFAULT_FILTERS: InventoryFilters = {
    search: '',
    statuses: [],
    projectIds: [],
    hostIds: [],
};

function countAppliedFilters(filters: InventoryFilters): number {
    let count = 0;
    if (filters.search.trim()) {
        count += 1;
    }
    if (filters.statuses.length > 0) {
        count += 1;
    }
    if (filters.projectIds.length > 0) {
        count += 1;
    }
    if (filters.hostIds.length > 0) {
        count += 1;
    }
    return count;
}

export function FleetInventoryView({ organizationId }: FleetInventoryViewProps) {
    const [density, setDensity] = useState<InventoryDensity>('DETAILED');
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [draftFilters, setDraftFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);

    const [loadingHosts, setLoadingHosts] = useState(true);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const [hosts, setHosts] = useState<FleetHostSummary[]>([]);
    const [hostTotals, setHostTotals] = useState({ hostCount: 0, containerCount: 0 });

    const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
    const [containersByHost, setContainersByHost] = useState<Record<string, FleetContainerSummary[]>>({});
    const [loadingContainersByHost, setLoadingContainersByHost] = useState<Record<string, boolean>>({});
    const [containerErrorsByHost, setContainerErrorsByHost] = useState<Record<string, string | null>>({});

    async function fetchHosts() {
        try {
            setHostsError(null);
            const response = await fetchFleetInventory(organizationId, appliedFilters);
            setHosts(response.hosts);
            setHostTotals(response.fleetTotals);
        } catch (error) {
            setHosts([]);
            setHostTotals({ hostCount: 0, containerCount: 0 });
            setHostsError(error instanceof Error ? error.message : 'Failed to load fleet inventory');
        } finally {
            setLoadingHosts(false);
        }
    }

    async function loadHostContainers(hostId: string) {
        try {
            setContainerErrorsByHost((current) => ({ ...current, [hostId]: null }));
            setLoadingContainersByHost((current) => ({ ...current, [hostId]: true }));
            const containers = await fetchHostContainers(hostId, organizationId, appliedFilters);
            setContainersByHost((current) => ({ ...current, [hostId]: containers }));
        } catch (error) {
            setContainersByHost((current) => ({ ...current, [hostId]: [] }));
            setContainerErrorsByHost((current) => ({
                ...current,
                [hostId]: error instanceof Error ? error.message : 'Failed to load host containers',
            }));
        } finally {
            setLoadingContainersByHost((current) => ({ ...current, [hostId]: false }));
        }
    }

    useEffect(() => {
        if (!organizationId) {
            return;
        }

        setContainersByHost({});
        setContainerErrorsByHost({});
        setLoadingContainersByHost({});
        setLoadingHosts(true);
        void fetchHosts();

        const interval = window.setInterval(() => {
            void fetchHosts();
        }, 30_000);

        return () => window.clearInterval(interval);
    }, [organizationId, appliedFilters]);

    useEffect(() => {
        setDensity(getInventoryDensityPreference());

        function onStorage(event: StorageEvent) {
            if (event.key === 'docker-dashboard:inventory-density') {
                setDensity(getInventoryDensityPreference());
            }
        }

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
        if (!expandedHostId) {
            return;
        }

        void loadHostContainers(expandedHostId);
    }, [expandedHostId, appliedFilters]);

    useEffect(() => {
        if (expandedHostId && !hosts.some((host) => host.id === expandedHostId)) {
            setExpandedHostId(null);
        }
    }, [expandedHostId, hosts]);

    const projectOptions = useMemo(() => {
        const deduped = new Map<string, string>();
        for (const host of hosts) {
            deduped.set(host.project.id, host.project.name);
        }

        return Array.from(deduped.entries()).map(([id, label]) => ({ id, label }));
    }, [hosts]);

    const hostOptions = useMemo(
        () => hosts.map((host) => ({ id: host.id, label: host.name })),
        [hosts]
    );

    const visibleHosts = useMemo(() => {
        return hosts.filter((host) => {
            if (appliedFilters.projectIds.length > 0 && !appliedFilters.projectIds.includes(host.project.id)) {
                return false;
            }
            if (appliedFilters.hostIds.length > 0 && !appliedFilters.hostIds.includes(host.id)) {
                return false;
            }
            return true;
        });
    }, [hosts, appliedFilters.projectIds, appliedFilters.hostIds]);

    const hasHosts = visibleHosts.length > 0;
    const expandedContainers = expandedHostId ? containersByHost[expandedHostId] ?? [] : [];
    const isExpandedLoading = expandedHostId ? loadingContainersByHost[expandedHostId] : false;
    const expandedHostError = expandedHostId ? containerErrorsByHost[expandedHostId] : null;
    const activeFilterCount = countAppliedFilters(appliedFilters);

    const onlineCount = useMemo(
        () => visibleHosts.filter((host) => host.status === 'ONLINE').length,
        [visibleHosts]
    );

    return (
        <section className="mt-8 space-y-4">
            <header className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-100">Fleet inventory</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            {hostTotals.hostCount} host{hostTotals.hostCount === 1 ? '' : 's'} total, {hostTotals.containerCount}{' '}
                            container{hostTotals.containerCount === 1 ? '' : 's'}, {onlineCount} online.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFilterPanelOpen((current) => !current)}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                        Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </button>
                </div>
            </header>

            <FleetFilters
                open={filterPanelOpen}
                draftFilters={draftFilters}
                appliedFilters={appliedFilters}
                projectOptions={projectOptions}
                hostOptions={hostOptions}
                onDraftChange={setDraftFilters}
                onClose={() => setFilterPanelOpen(false)}
                onReset={() => {
                    setDraftFilters(DEFAULT_FILTERS);
                    setAppliedFilters(DEFAULT_FILTERS);
                }}
                onApply={() => {
                    setAppliedFilters({
                        search: draftFilters.search,
                        statuses: [...draftFilters.statuses],
                        projectIds: [...draftFilters.projectIds],
                        hostIds: [...draftFilters.hostIds],
                    });
                }}
            />

            {loadingHosts ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
                    Loading fleet inventory...
                </div>
            ) : null}

            {hostsError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {hostsError}
                </div>
            ) : null}

            {!loadingHosts && !hostsError && !hasHosts ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-6">
                    <h3 className="text-base font-semibold text-slate-100">No hosts enrolled yet</h3>
                    <p className="mt-1 text-sm text-slate-400">
                        Add your first host from the toolbar above to start building fleet visibility.
                    </p>
                </div>
            ) : null}

            {!loadingHosts && !hostsError && hasHosts ? (
                <div className="space-y-3">
                    {visibleHosts.map((host) => {
                        const isExpanded = host.id === expandedHostId;

                        return (
                            <div key={host.id} className="space-y-3">
                                <HostCard
                                    host={host}
                                    expanded={isExpanded}
                                    density={density}
                                    onToggle={() => {
                                        if (isExpanded) {
                                            setExpandedHostId(null);
                                            return;
                                        }
                                        setExpandedHostId(host.id);
                                    }}
                                />

                                {isExpanded ? (
                                    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-slate-200">
                                                Containers on {host.name}
                                            </h3>
                                            <span className="text-xs text-slate-500">Project: {host.project.name}</span>
                                        </div>

                                        {appliedFilters.search.trim() ? (
                                            <p className="mb-3 text-xs text-slate-500">
                                                Search query: <span className="text-slate-300">{appliedFilters.search.trim()}</span>
                                            </p>
                                        ) : null}

                                        {isExpandedLoading ? (
                                            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                                                Loading containers...
                                            </div>
                                        ) : null}

                                        {!isExpandedLoading && expandedHostError ? (
                                            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                                                {expandedHostError}
                                            </div>
                                        ) : null}

                                        {!isExpandedLoading && !expandedHostError ? (
                                            <ContainerCardGrid
                                                containers={expandedContainers}
                                                density={density}
                                                emptyMessage={
                                                    appliedFilters.search || appliedFilters.statuses.length
                                                        ? 'No containers match your search'
                                                        : 'No containers reported for this host yet.'
                                                }
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
}
