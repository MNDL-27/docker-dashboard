'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ContainerCardGrid } from './ContainerCardGrid';
import { HostCard } from './HostCard';

interface FleetHost {
    id: string;
    name: string;
    hostname: string;
    status: 'ONLINE' | 'OFFLINE';
    lastSeen: string | null;
    containerCount: number;
    ipAddress: string | null;
    agentVersion: string | null;
    cpuCount: number | null;
    memoryTotalBytes: string | number | null;
    project: {
        id: string;
        name: string;
    };
}

interface FleetContainer {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    restartCount: number;
    dockerCreatedAt: string | null;
    labels: Record<string, string> | null;
    ports: Record<string, unknown> | null;
    networks: unknown;
    volumes: unknown;
}

interface FleetInventoryResponse {
    fleetTotals: {
        hostCount: number;
        containerCount: number;
    };
    hosts: FleetHost[];
}

interface FleetInventoryViewProps {
    organizationId: string;
}

export function FleetInventoryView({ organizationId }: FleetInventoryViewProps) {
    const [loadingHosts, setLoadingHosts] = useState(true);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const [hosts, setHosts] = useState<FleetHost[]>([]);
    const [hostTotals, setHostTotals] = useState({ hostCount: 0, containerCount: 0 });

    const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
    const [containersByHost, setContainersByHost] = useState<Record<string, FleetContainer[]>>({});
    const [loadingContainersByHost, setLoadingContainersByHost] = useState<Record<string, boolean>>({});
    const [containerErrorsByHost, setContainerErrorsByHost] = useState<Record<string, string | null>>({});

    async function fetchHosts() {
        try {
            setHostsError(null);
            const query = new URLSearchParams({ organizationId });
            const response = await apiFetch<FleetInventoryResponse>(`/api/hosts?${query.toString()}`);
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

    async function fetchHostContainers(hostId: string) {
        try {
            setContainerErrorsByHost((current) => ({ ...current, [hostId]: null }));
            setLoadingContainersByHost((current) => ({ ...current, [hostId]: true }));

            const query = new URLSearchParams({ organizationId });
            const response = await apiFetch<{ containers: FleetContainer[] }>(
                `/api/hosts/${hostId}/containers?${query.toString()}`
            );

            setContainersByHost((current) => ({ ...current, [hostId]: response.containers }));
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

        setLoadingHosts(true);
        void fetchHosts();

        const interval = window.setInterval(() => {
            void fetchHosts();
        }, 30_000);

        return () => window.clearInterval(interval);
    }, [organizationId]);

    useEffect(() => {
        if (!expandedHostId) {
            return;
        }

        if (containersByHost[expandedHostId]) {
            return;
        }

        void fetchHostContainers(expandedHostId);
    }, [expandedHostId, containersByHost]);

    useEffect(() => {
        if (expandedHostId && !hosts.some((host) => host.id === expandedHostId)) {
            setExpandedHostId(null);
        }
    }, [expandedHostId, hosts]);

    const hasHosts = hosts.length > 0;
    const expandedContainers = expandedHostId ? containersByHost[expandedHostId] ?? [] : [];
    const isExpandedLoading = expandedHostId ? loadingContainersByHost[expandedHostId] : false;
    const expandedHostError = expandedHostId ? containerErrorsByHost[expandedHostId] : null;

    const onlineCount = useMemo(
        () => hosts.filter((host) => host.status === 'ONLINE').length,
        [hosts]
    );

    return (
        <section className="mt-8 space-y-4">
            <header className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <h2 className="text-lg font-semibold text-slate-100">Fleet inventory</h2>
                <p className="mt-1 text-sm text-slate-400">
                    {hostTotals.hostCount} host{hostTotals.hostCount === 1 ? '' : 's'} total, {hostTotals.containerCount} container
                    {hostTotals.containerCount === 1 ? '' : 's'}, {onlineCount} online.
                </p>
            </header>

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
                    {hosts.map((host) => {
                        const isExpanded = host.id === expandedHostId;

                        return (
                            <div key={host.id} className="space-y-3">
                                <HostCard
                                    host={host}
                                    expanded={isExpanded}
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
                                            <ContainerCardGrid containers={expandedContainers} />
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
