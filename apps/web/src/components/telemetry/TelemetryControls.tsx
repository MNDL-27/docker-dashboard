'use client';

import { TelemetryHistoryWindow, TELEMETRY_HISTORY_WINDOWS, TelemetrySpeedPreset, TELEMETRY_SPEED_PRESETS } from '@/lib/api';

interface TelemetryControlsProps {
    windowPreset: TelemetryHistoryWindow;
    paused: boolean;
    speed: TelemetrySpeedPreset;
    onWindowChange: (windowPreset: TelemetryHistoryWindow) => void;
    onTogglePause: () => void;
    onSpeedChange: (speed: TelemetrySpeedPreset) => void;
}

export function TelemetryControls({
    windowPreset,
    paused,
    speed,
    onWindowChange,
    onTogglePause,
    onSpeedChange,
}: TelemetryControlsProps) {
    return (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">Telemetry controls</h3>
                <button
                    type="button"
                    onClick={onTogglePause}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-500"
                >
                    {paused ? 'Resume live' : 'Pause live'}
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {TELEMETRY_HISTORY_WINDOWS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => onWindowChange(preset)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            windowPreset === preset
                                ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-500/60'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {preset}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Speed</span>
                {TELEMETRY_SPEED_PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => onSpeedChange(preset)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                            speed === preset
                                ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/60'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {preset}
                    </button>
                ))}
            </div>
        </div>
    );
}
