'use client';

interface ContainerCard {
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

interface ContainerCardGridProps {
    containers: ContainerCard[];
}

function formatTimestamp(timestamp: string | null): string {
    if (!timestamp) {
        return 'Unknown';
    }
    return new Date(timestamp).toLocaleString();
}

function statusClass(state: string): string {
    const normalized = state.toLowerCase();
    if (normalized.includes('running')) {
        return 'bg-emerald-500/15 text-emerald-300';
    }
    if (normalized.includes('restart')) {
        return 'bg-amber-500/15 text-amber-300';
    }
    if (normalized.includes('exited') || normalized.includes('stopped') || normalized.includes('dead')) {
        return 'bg-rose-500/15 text-rose-300';
    }
    return 'bg-slate-700 text-slate-300';
}

function normalizePorts(ports: Record<string, unknown> | null): string[] {
    if (!ports) {
        return [];
    }

    return Object.entries(ports).map(([internalPort, external]) => {
        if (!external) {
            return internalPort;
        }

        if (Array.isArray(external)) {
            return external
                .map((binding) => {
                    if (!binding || typeof binding !== 'object') {
                        return internalPort;
                    }

                    const hostIp = 'HostIp' in binding ? String((binding as { HostIp?: string }).HostIp ?? '') : '';
                    const hostPort =
                        'HostPort' in binding ? String((binding as { HostPort?: string }).HostPort ?? '') : '';
                    return hostPort ? `${hostIp ? `${hostIp}:` : ''}${hostPort}->${internalPort}` : internalPort;
                })
                .join(', ');
        }

        return `${String(external)}->${internalPort}`;
    });
}

function normalizeListField(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry));
    }

    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>);
    }

    return [];
}

export function ContainerCardGrid({ containers }: ContainerCardGridProps) {
    if (containers.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
                No containers match this selection.
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {containers.map((container) => {
                const labels = Object.entries(container.labels ?? {});
                const ports = normalizePorts(container.ports);
                const networks = normalizeListField(container.networks);
                const volumes = normalizeListField(container.volumes);

                return (
                    <article key={container.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-100">{container.name}</h4>
                                <p className="text-xs text-slate-400">{container.image}</p>
                            </div>
                            <span
                                className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(
                                    container.state
                                )}`}
                            >
                                {container.state}
                            </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                            <div>
                                <div className="text-slate-500">Status</div>
                                <div>{container.status}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Restarts</div>
                                <div>{container.restartCount}</div>
                            </div>
                            <div>
                                <div className="text-slate-500">Created</div>
                                <div>{formatTimestamp(container.dockerCreatedAt)}</div>
                            </div>
                        </div>

                        <div className="mt-3 space-y-2 text-xs text-slate-300">
                            <div>
                                <div className="text-slate-500">Labels</div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    {labels.length ? (
                                        labels.slice(0, 6).map(([key, value]) => (
                                            <span key={key} className="rounded border border-slate-700 px-1.5 py-0.5 text-[11px]">
                                                {key}={String(value)}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-slate-500">None</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-slate-500">Ports</div>
                                <div>{ports.length ? ports.join(', ') : 'None'}</div>
                            </div>

                            <div>
                                <div className="text-slate-500">Networks</div>
                                <div>{networks.length ? networks.join(', ') : 'None'}</div>
                            </div>

                            <div>
                                <div className="text-slate-500">Volumes</div>
                                <div>{volumes.length ? volumes.join(', ') : 'None'}</div>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
