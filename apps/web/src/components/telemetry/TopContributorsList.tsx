'use client';

import { TelemetryContributor } from '@/lib/api';

interface TopContributorsListProps {
    contributors: TelemetryContributor[];
    selectedContainerId?: string | null;
    onSelectContainer?: (containerId: string) => void;
}

function formatMemory(value: number): string {
    if (value <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }

    const precision = size >= 10 || unit === 0 ? 0 : 1;
    return `${size.toFixed(precision)} ${units[unit]}`;
}

export function TopContributorsList({ contributors, selectedContainerId, onSelectContainer }: TopContributorsListProps) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Top contributors</h3>
                <span className="text-xs text-slate-500">CPU priority</span>
            </div>

            {contributors.length === 0 ? (
                <p className="text-sm text-slate-400">No contributors in the current telemetry scope.</p>
            ) : (
                <ol className="space-y-2">
                    {contributors.map((contributor, index) => {
                        const selected = selectedContainerId === contributor.containerId;
                        const Cell = onSelectContainer ? 'button' : 'div';

                        return (
                            <li key={contributor.containerId}>
                                <Cell
                                    type={onSelectContainer ? 'button' : undefined}
                                    onClick={
                                        onSelectContainer
                                            ? () => {
                                                  onSelectContainer(contributor.containerId);
                                              }
                                            : undefined
                                    }
                                    className={`w-full rounded-lg border p-3 text-left transition ${
                                        selected
                                            ? 'border-blue-500/60 bg-blue-500/10'
                                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-100">
                                                {index + 1}. {contributor.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {contributor.state} - {contributor.restartCount} restart{contributor.restartCount === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-slate-300">
                                            <p>{contributor.cpuUsagePercent.toFixed(1)}% CPU</p>
                                            <p>{formatMemory(contributor.memoryUsageBytes)} memory</p>
                                        </div>
                                    </div>
                                </Cell>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
