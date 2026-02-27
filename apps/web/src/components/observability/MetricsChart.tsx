'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { format } from 'date-fns';

export interface MetricData {
    timestamp: string;
    cpuUsagePercent: number;
    memoryUsageBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
}

interface Props {
    data: MetricData[];
    type: 'cpu' | 'memory' | 'network';
}

export default function MetricsChart({ data, type }: Props) {
    const formatTime = (ts: any) => {
        try {
            if (!ts) return '';
            return format(new Date(ts), 'HH:mm:ss');
        } catch {
            return '';
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full h-80 bg-slate-900 rounded-lg p-4 border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 mb-4 capitalize">
                {type} Usage
            </h3>
            <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatTime}
                            stroke="#94a3b8"
                            fontSize={12}
                            tickMargin={10}
                        />
                        {type === 'cpu' && (
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickFormatter={(val) => `${val}%`}
                                domain={[0, 'auto']}
                            />
                        )}
                        {type === 'memory' && (
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickFormatter={formatBytes}
                                width={80}
                            />
                        )}
                        {type === 'network' && (
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickFormatter={formatBytes}
                                width={80}
                            />
                        )}

                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                            labelFormatter={formatTime}
                        />

                        {type === 'cpu' && (
                            <Line
                                type="monotone"
                                dataKey="cpuUsagePercent"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                name="CPU Usage"
                            />
                        )}
                        {type === 'memory' && (
                            <Line
                                type="monotone"
                                dataKey="memoryUsageBytes"
                                stroke="#10B981"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                                name="Memory Usage"
                            />
                        )}
                        {type === 'network' && (
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="networkRxBytes"
                                    stroke="#F59E0B"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                    name="Network In (RX)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="networkTxBytes"
                                    stroke="#8B5CF6"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={false}
                                    name="Network Out (TX)"
                                />
                                <Legend />
                            </>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
