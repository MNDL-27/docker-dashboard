import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const mockData = [
  { time: '00:00', cpu: 32, memory: 45 },
  { time: '04:00', cpu: 28, memory: 48 },
  { time: '08:00', cpu: 45, memory: 52 },
  { time: '12:00', cpu: 55, memory: 65 },
  { time: '16:00', cpu: 42, memory: 68 },
  { time: '20:00', cpu: 38, memory: 62 },
  { time: '23:59', cpu: 35, memory: 58 },
];

interface FleetResourceChartProps {
  data?: { time: string; cpu: number; memory: number }[];
  className?: string;
}

export function FleetResourceChart({ data = mockData, className }: FleetResourceChartProps) {
  return (
    <div className={cn("glass-card overflow-hidden flex flex-col h-full", className)}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">Fleet Resource Trends</h3>
        </div>
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
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
            />
            <Area 
              type="monotone" 
              dataKey="cpu" 
              name="CPU Usage"
              stroke="#0EA5E9" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCpu)" 
            />
            <Area 
              type="monotone" 
              dataKey="memory" 
              name="Memory Usage"
              stroke="#10B981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorMem)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
