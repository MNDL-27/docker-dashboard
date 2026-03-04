'use client';

import { InventoryFilters } from '@/lib/api';

const STATUS_OPTIONS = [
    { value: 'running', label: 'Running' },
    { value: 'stopped', label: 'Stopped' },
    { value: 'restarting', label: 'Restarting' },
    { value: 'paused', label: 'Paused' },
    { value: 'exited', label: 'Exited' },
];

interface Option {
    id: string;
    label: string;
}

interface FleetFiltersProps {
    open: boolean;
    draftFilters: InventoryFilters;
    appliedFilters: InventoryFilters;
    projectOptions: Option[];
    hostOptions: Option[];
    onDraftChange: (next: InventoryFilters) => void;
    onApply: () => void;
    onClose: () => void;
    onReset: () => void;
}

function toggleSelection(values: string[], target: string): string[] {
    return values.includes(target) ? values.filter((item) => item !== target) : [...values, target];
}

export function FleetFilters({
    open,
    draftFilters,
    appliedFilters,
    projectOptions,
    hostOptions,
    onDraftChange,
    onApply,
    onClose,
    onReset,
}: FleetFiltersProps) {
    if (!open) {
        return null;
    }

    const hasPendingChanges = JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Filters</h3>
                <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
                    Close
                </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
                <div className="lg:col-span-4">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
                    <input
                        type="text"
                        value={draftFilters.search}
                        onChange={(event) => {
                            onDraftChange({
                                ...draftFilters,
                                search: event.target.value,
                            });
                        }}
                        placeholder="Search by container name, image, or labels"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                </div>

                <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                    <div className="space-y-1.5">
                        {STATUS_OPTIONS.map((option) => (
                            <label key={option.value} className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={draftFilters.statuses.includes(option.value)}
                                    onChange={() => {
                                        onDraftChange({
                                            ...draftFilters,
                                            statuses: toggleSelection(draftFilters.statuses, option.value),
                                        });
                                    }}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Projects</p>
                    <div className="max-h-36 space-y-1.5 overflow-y-auto">
                        {projectOptions.map((project) => (
                            <label key={project.id} className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={draftFilters.projectIds.includes(project.id)}
                                    onChange={() => {
                                        onDraftChange({
                                            ...draftFilters,
                                            projectIds: toggleSelection(draftFilters.projectIds, project.id),
                                        });
                                    }}
                                />
                                {project.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Hosts</p>
                    <div className="max-h-36 space-y-1.5 overflow-y-auto">
                        {hostOptions.map((host) => (
                            <label key={host.id} className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={draftFilters.hostIds.includes(host.id)}
                                    onChange={() => {
                                        onDraftChange({
                                            ...draftFilters,
                                            hostIds: toggleSelection(draftFilters.hostIds, host.id),
                                        });
                                    }}
                                />
                                {host.label}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
                >
                    Reset
                </button>
                <button
                    type="button"
                    onClick={onApply}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                    {hasPendingChanges ? 'Apply' : 'Apply (No Changes)'}
                </button>
            </div>
        </div>
    );
}
