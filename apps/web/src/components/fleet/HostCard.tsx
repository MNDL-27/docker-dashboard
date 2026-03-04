'use client';

interface HostCardData {
    id: string;
    name: string;
    hostname: string;
    status: 'ONLINE' | 'OFFLINE';
    containerCount: number;
    lastSeen: string | null;
    ipAddress: string | null;
    agentVersion: string | null;
    cpuCount: number | null;
    memoryTotalBytes: string | number | null;
}

interface HostCardProps {
    host: HostCardData;
    expanded: boolean;
    onToggle: () => void;
}

function formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) {
        return 'Never reported';
    }
    return new Date(lastSeen).toLocaleString();
}

function formatBytes(bytes: string | number | null): string {
    if (bytes === null || bytes === undefined) {
        return 'Unknown';
    }

    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) {
        return 'Unknown';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let normalized = value;

    while (normalized >= 1024 && unitIndex < units.length - 1) {
        normalized /= 1024;
        unitIndex += 1;
    }

    return `${normalized.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function HostCard({ host, expanded, onToggle }: HostCardProps) {
    const isOnline = host.status === 'ONLINE';

    return (
        <button
            type="button"
            onClick={onToggle}
            className={`w-full rounded-xl border p-4 text-left transition ${
                expanded
                    ? 'border-blue-500/70 bg-slate-900 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
            }`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-slate-100">{host.name}</h3>
                    <p className="text-xs text-slate-500">{host.hostname}</p>
                </div>
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        isOnline
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                    }`}
                >
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-2 lg:grid-cols-4">
                <div>
                    <div className="text-xs text-slate-500">Containers</div>
                    <div>{host.containerCount}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">Last seen</div>
                    <div>{formatLastSeen(host.lastSeen)}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">IP address</div>
                    <div>{host.ipAddress ?? 'Unknown'}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">Agent version</div>
                    <div>{host.agentVersion ?? 'Unknown'}</div>
                </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                <div>
                    <div className="text-xs text-slate-500">CPU summary</div>
                    <div>{host.cpuCount ? `${host.cpuCount} cores` : 'Unknown'}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500">Memory summary</div>
                    <div>{formatBytes(host.memoryTotalBytes)}</div>
                </div>
            </div>
        </button>
    );
}
