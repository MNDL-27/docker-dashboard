'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';

export interface LogEntry {
    timestamp?: string;
    stream: string;
    message: string;
}

interface Props {
    logs: LogEntry[];
    containerName: string;
}

export default function LogStream({ logs, containerName }: Props) {
    const [isPaused, setIsPaused] = useState(false);
    const [displayLogs, setDisplayLogs] = useState<LogEntry[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // When unpaused, synchronize the display logs with the real-time incoming logs array.
    // When paused, we ignore new incoming props.
    useEffect(() => {
        if (!isPaused) {
            setDisplayLogs(logs);
        }
    }, [logs, isPaused]);

    // Auto-scroll Down
    useEffect(() => {
        if (!isPaused && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [displayLogs, isPaused]);

    const togglePause = () => setIsPaused(!isPaused);

    const downloadLogs = () => {
        const textBlob = new Blob([displayLogs.map(l => `[${l.stream}] ${l.message}`).join('\n')], { type: 'text/plain' });
        const url = window.URL.createObjectURL(textBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${containerName}-logs-${new Date().toISOString()}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col bg-[#0d1117] border border-slate-800 rounded-lg overflow-hidden h-[500px]">
            <div className="flex justify-between items-center bg-slate-900 border-b border-slate-800 px-4 py-2">
                <h3 className="text-sm font-medium text-slate-300 font-mono">Terminal: {containerName}</h3>
                <div className="flex gap-2">
                    <button
                        onClick={togglePause}
                        className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                    >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                        onClick={downloadLogs}
                        className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                        title="Download Logs"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed text-slate-300"
            >
                {displayLogs.length === 0 ? (
                    <div className="text-slate-500 italic">Waiting for log stream...</div>
                ) : (
                    displayLogs.map((log, idx) => (
                        <div key={idx} className="break-all whitespace-pre-wrap flex gap-3 hover:bg-white/5 px-1 rounded">
                            {log.timestamp && (
                                <span className="text-slate-500 shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                            )}
                            <span className={log.stream === 'stderr' ? 'text-red-400' : 'text-slate-300'}>
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
