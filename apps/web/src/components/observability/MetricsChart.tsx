'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
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

function formatTime(ts: unknown): string {
    try {
        if (!ts) return '';
        return format(new Date(ts as string), 'HH:mm:ss');
    } catch {
        return '';
    }
}

function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function MetricsChart({ data, type }: Props) {
    return (
        <div className="glass-card">
            <h3 className="chart-title">{type} Usage</h3>
            <div className="chart-body">
                <ResponsiveContainer width="100%" height={250}>
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
                        {(type === 'memory' || type === 'network') && (
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickFormatter={formatBytes}
                                width={80}
                            />
                        )}

                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#f8fafc',
                            }}
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

            <style jsx>{`
                .glass-card {
                    background: rgba(30, 41, 59, 0.6);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                    border-radius: 16px;
                    padding: 20px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }
                .chart-title {
                    font-size: 14px;
                    font-weight: 500;
                    color: #94a3b8;
                    margin-bottom: 16px;
                    text-transform: capitalize;
                }
                .chart-body {
                    width: 100%;
                    height: 250px;
                }
            `}</style>
        </div>
    );
}