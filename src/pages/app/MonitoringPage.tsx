import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { metricsTimeSeries } from "@/lib/mock-data";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Cpu, HardDrive, Wifi, Database } from "lucide-react";
import { useState } from "react";

const timeRanges = ["1h", "6h", "24h", "7d", "30d"];

export default function MonitoringPage() {
  const [range, setRange] = useState("24h");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring"
        description="Resource utilization and performance metrics"
        breadcrumbs={[{ label: "Observability" }, { label: "Monitoring" }]}
        actions={
          <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
            {timeRanges.map(t => (
              <button key={t} onClick={() => setRange(t)} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${range === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Avg CPU" value="38%" change="+4%" changeType="negative" icon={Cpu} />
        <MetricCard label="Avg Memory" value="61%" change="-2%" changeType="positive" icon={HardDrive} />
        <MetricCard label="Network I/O" value="342 MB/s" change="+12%" changeType="neutral" icon={Wifi} />
        <MetricCard label="Disk Usage" value="42%" change="+1%" changeType="neutral" icon={Database} />
      </div>

      {[
        { title: "CPU Usage", key: "cpu" as const, color: "190, 80%, 50%", unit: "%" },
        { title: "Memory Usage", key: "memory" as const, color: "38, 92%, 50%", unit: "%" },
        { title: "Network I/O", key: "network" as const, color: "142, 71%, 45%", unit: " MB/s" },
        { title: "Disk Usage", key: "disk" as const, color: "280, 60%, 55%", unit: "%" },
      ].map(chart => (
        <div key={chart.key} className="glass-card p-4">
          <h3 className="text-sm font-medium mb-4">{chart.title}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={metricsTimeSeries}>
              <defs>
                <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`hsl(${chart.color})`} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={`hsl(${chart.color})`} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 16%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 20%, 10%)", border: "1px solid hsl(220, 16%, 16%)", borderRadius: "8px", fontSize: 12 }} />
              <Area type="monotone" dataKey={chart.key} stroke={`hsl(${chart.color})`} fill={`url(#grad-${chart.key})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
