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
           time: t,
           cpu: cpu,
           memory: memory,
           usedCores: (cpu / 100) * totalCoresMock,
           totalCores: totalCoresMock,
           memoryUsed: (memory / 100) * memoryLimitMock,
           memoryLimit: memoryLimitMock,
         });
       }
       setChartData(initialData);
     }
   }, [orgId, maxDataPoints]);

  // Update with new data points as they come in
  useEffect(() => {
    if (newData && newData.length > 0) {
      setChartData((prev) => {
        const updated = [...prev, ...newData];
        if (updated.length > maxDataPoints) {
          return updated.slice(-maxDataPoints);
        }
        return updated;
      });
    }
  }, [newData, maxDataPoints]);

  const displayData = chartData.length > 0 ? chartData : [];

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
              unit="%"
              domain={[0, 'auto']}
              allowDecimals={false}
            />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(13, 17, 23, 0.95)', 
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number, name: string, payload: any) => {
                  if (!payload || !payload.payload) {
                    return [`${value}%`, ''];
                  }
                  // Find the item in the payload that corresponds to the current series name
                  const item = payload.payload.find((p: any) => p.name === name);
                  if (!item || !item.payload) {
                    return [`${value}%`, ''];
                  }
                  const dataPoint = item.payload;
                  
                  if (name === 'CPU Usage') {
                    const cpuPercent = value;
                    const usedCores = dataPoint?.usedCores ?? 0;
                    const totalCores = dataPoint?.totalCores ?? 0;
                    return [
                      `CPU: ${cpuPercent}% of fleet`,
                      `Load: ${usedCores.toFixed(2)} / ${totalCores.toFixed(2)} cores`
                    ];
                  }
                  if (name === 'Memory Usage') {
                    const memPercent = value;
                    const memoryUsedBytes = dataPoint?.memoryUsed ?? 0;
                    const memoryLimitBytes = dataPoint?.memoryLimit ?? 0;
                    
                    // Convert bytes to human readable format
                    const formatBytes = (bytes: number): string => {
                      if (bytes === 0) return '0 B';
                      const k = 1024;
                      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    };
                    
                    return [
                      `Memory: ${memPercent}% of fleet`,
                      `${formatBytes(memoryUsedBytes)} / ${formatBytes(memoryLimitBytes)}`
                    ];
                  }
                  return [`${value}%`, ''];
                }}
              />
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
    </div>
  );
}
