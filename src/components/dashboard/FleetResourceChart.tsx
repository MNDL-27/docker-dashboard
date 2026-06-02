import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useFleetMetrics, type FleetMetrics } from "@/hooks/useFleetMetrics";
import { buildInitialFleetData } from "./fleet-resource-helpers";

interface FleetResourceChartProps {
  orgId: string | null;
  className?: string;
  maxDataPoints?: number;
  refetchInterval?: number | false;
}

const MAX_DATA_POINTS = 20;

function formatPercentage(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond === null || bytesPerSecond === undefined || bytesPerSecond < 0) {
    return 'N/A';
  }

  if (bytesPerSecond === 0) {
    return '0.00 B/s';
  }

  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
  const i = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(k)), sizes.length - 1);
  return `${(bytesPerSecond / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

interface FleetResourceTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | string;
    payload?: FleetMetrics;
  }>;
}

function FleetResourceTooltip({ active, label, payload }: FleetResourceTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const dataPoint = payload[0]?.payload;
  if (!dataPoint) {
    return null;
  }

  const cpuEntry = payload.find((item) => item.name === 'CPU Usage');
  const memoryEntry = payload.find((item) => item.name === 'Memory Usage');
  const cpuPercent = Number.isFinite(Number(cpuEntry?.value)) ? Number(cpuEntry?.value) : dataPoint.cpu;
  const memoryPercent = Number.isFinite(Number(memoryEntry?.value)) ? Number(memoryEntry?.value) : dataPoint.memory;

  return (
    <div
      style={{
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#fff',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        padding: '10px 12px',
        minWidth: '280px',
      }}
    >
      {label && (
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>
          {label}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div>
          <span style={{ color: '#0EA5E9', fontWeight: 700 }}>CPU:</span>{' '}
          <span>
            {formatPercentage(cpuPercent)}% of fleet (Load: {dataPoint.usedCores.toFixed(2)} / {dataPoint.totalCores.toFixed(2)} cores)
          </span>
        </div>

        <div>
          <span style={{ color: '#10B981', fontWeight: 700 }}>Memory:</span>{' '}
          <span>
            {formatPercentage(memoryPercent)}% of fleet ({formatBytes(dataPoint.memoryUsed)} / {formatBytes(dataPoint.memoryLimit)})
          </span>
        </div>

        <div>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Network In:</span>{' '}
          <span>{formatSpeed(dataPoint.networkInBytesPerSec)}</span>
        </div>

        <div>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Network Out:</span>{' '}
          <span>{formatSpeed(dataPoint.networkOutBytesPerSec)}</span>
        </div>

        <div>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Disk Read:</span>{' '}
          <span>{formatSpeed(dataPoint.diskReadBytesPerSec)}</span>
        </div>

        <div>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>Disk Write:</span>{' '}
          <span>{formatSpeed(dataPoint.diskWriteBytesPerSec)}</span>
        </div>
      </div>
    </div>
  );
}

interface CompactMetricProps {
  label: string;
  value: string;
}

function CompactMetric({ label, value }: CompactMetricProps) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80">{label}</div>
      <div className="text-xs font-semibold tabular-nums text-foreground mt-0.5">{value}</div>
    </div>
  );
}

export function FleetResourceChart({
  orgId,
  className,
  maxDataPoints = MAX_DATA_POINTS,
  refetchInterval = 10000,
}: FleetResourceChartProps) {
  const [chartData, setChartData] = useState<FleetMetrics[]>([]);
  const { data: newData, isLoading, error } = useFleetMetrics(orgId, refetchInterval);

  // Bootstrap with mocked points if empty. Uses functional setState so chartData isn't a dep.
  useEffect(() => {
    setChartData((current) => (current.length === 0 && orgId ? buildInitialFleetData(maxDataPoints) : current));
  }, [orgId, maxDataPoints]);

  // Update with new data points as they come in
  useEffect(() => {
    if (newData && newData.length > 0) {
      setChartData((prev) => {
        const updated = [...prev, ...newData]
          .filter((point) => Number.isFinite(point.timestamp))
          .sort((a, b) => a.timestamp - b.timestamp);

        if (updated.length > maxDataPoints) {
          return updated.slice(-maxDataPoints);
        }

        return updated;
      });
    }
  }, [newData, maxDataPoints]);

  const displayData = chartData.length > 0 ? chartData : [];
  const latestPoint = displayData.length > 0 ? displayData[displayData.length - 1] : undefined;

  return (
    <div className={cn("glass-card overflow-hidden flex flex-col h-full", className)}>
      <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between gap-2">
       <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight truncate">Fleet Resource Trends</h3>
          </div>
        {isLoading && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Updating...</span>
          </div>
        )}
        {!isLoading && error instanceof Error ? (
          <span className="text-[10px] text-destructive">{error.message}</span>
        ) : null}
         <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" />
              <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase opacity-70">CPU</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-success" />
              <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase opacity-70">MEM</span>
            </div>
          </div>
      </div>
      
      <div className="flex-1 p-3 sm:p-4 sm:pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontWeight: 600 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontWeight: 600 }}
              domain={[0, 'auto']}
              allowDecimals={false}
              tickFormatter={(value: number | string) => `${formatPercentage(typeof value === 'number' ? value : Number(value))}%`}
            />
            <Tooltip content={<FleetResourceTooltip />} />
            <Area 
              type="monotone" 
              dataKey="cpu" 
              name="CPU Usage"
              stroke="#0EA5E9" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCpu)" 
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey="memory" 
              name="Memory Usage"
              stroke="#10B981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorMem)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-white/5">
        <div className="grid grid-cols-2 gap-2">
          <CompactMetric label="Network In" value={formatSpeed(latestPoint?.networkInBytesPerSec ?? null)} />
          <CompactMetric label="Network Out" value={formatSpeed(latestPoint?.networkOutBytesPerSec ?? null)} />
          <CompactMetric label="Disk Read" value={formatSpeed(latestPoint?.diskReadBytesPerSec ?? null)} />
          <CompactMetric label="Disk Write" value={formatSpeed(latestPoint?.diskWriteBytesPerSec ?? null)} />
        </div>
      </div>
    </div>
  );
}
