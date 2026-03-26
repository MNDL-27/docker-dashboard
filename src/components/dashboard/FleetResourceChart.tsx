import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useFleetMetrics, type FleetMetrics } from "@/hooks/useFleetMetrics";

interface FleetResourceChartProps {
  orgId: string | null;
  className?: string;
  maxDataPoints?: number;
}

const MAX_DATA_POINTS = 20;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.00 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

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

export function FleetResourceChart({ orgId, className, maxDataPoints = MAX_DATA_POINTS }: FleetResourceChartProps) {
  const [chartData, setChartData] = useState<FleetMetrics[]>([]);
  const { data: newData, isLoading } = useFleetMetrics(orgId);

       // Initialize with some data points if empty (only once)
   useEffect(() => {
     if (chartData.length === 0 && orgId) {
       const now = new Date();
       const initialData: FleetMetrics[] = [];
        for (let i = maxDataPoints - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60000);
          const t = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          const cpu = Math.max(0, Math.min(100, 30 + Math.random() * 20));
          const memory = Math.max(0, Math.min(100, 45 + Math.random() * 20));
         // Mock data for new fields: assume 4 cores and 8GB memory for initial mock
          const totalCoresMock = 4;
          const memoryLimitMock = 8 * 1024 * 1024 * 1024; // 8GB in bytes
           initialData.push({
             timestamp: date.getTime(),
             time: t,
             cpu: cpu,
             memory: memory,
             usedCores: (cpu / 100) * totalCoresMock,
             totalCores: totalCoresMock,
            memoryUsed: (memory / 100) * memoryLimitMock,
            memoryLimit: memoryLimitMock,
            networkInBytesPerSec: null,
            networkOutBytesPerSec: null,
            diskReadBytesPerSec: null,
            diskWriteBytesPerSec: null,
          });
        }
        setChartData(initialData);
      }
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
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
       <div className="flex items-center gap-2">
           <Activity className="h-4 w-4 text-primary" />
           <h3 className="text-sm font-semibold tracking-tight">Fleet Resource Trends</h3>
         </div>
        {isLoading && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Updating...</span>
          </div>
        )}
         <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-primary" />
             <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">CPU</span>
           </div>
           <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-success" />
             <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">MEM</span>
           </div>
         </div>
      </div>
      
      <div className="flex-1 p-4 pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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

      <div className="px-4 pb-4 pt-2 border-t border-white/5">
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
