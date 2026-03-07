import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Server, Box, Cpu, HardDrive, Bell, AlertTriangle, ArrowUpRight, Activity, Clock, Zap } from "lucide-react";
import { hosts, containers, alerts, incidents, activityFeed, metricsTimeSeries } from "@/lib/mock-data";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useState } from "react";

const timeRanges = ["1h", "6h", "24h", "7d", "30d"];

const containerStates = [
  { name: "Running", value: containers.filter(c => c.status === "running").length, color: "hsl(142, 71%, 45%)" },
  { name: "Unhealthy", value: containers.filter(c => c.status === "unhealthy").length, color: "hsl(0, 72%, 51%)" },
  { name: "Restarting", value: containers.filter(c => c.status === "restarting").length, color: "hsl(190, 80%, 50%)" },
  { name: "Exited", value: containers.filter(c => c.status === "exited").length, color: "hsl(220, 9%, 46%)" },
];

export default function DashboardPage() {
  const [range, setRange] = useState("24h");
  const healthyHosts = hosts.filter(h => h.status === "healthy").length;
  const criticalHosts = hosts.filter(h => h.status === "critical" || h.status === "warning" || h.status === "offline").length;
  const runningContainers = containers.filter(c => c.status === "running").length;
  const firingAlerts = alerts.filter(a => a.status === "firing").length;
  const openIncidents = incidents.filter(i => i.status !== "resolved").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Overview of your Docker infrastructure"
        actions={
          <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
            {timeRanges.map(t => (
              <button key={t} onClick={() => setRange(t)} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${range === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Hosts" value={hosts.length} change="+2 this week" changeType="positive" icon={Server} />
        <MetricCard label="Healthy Hosts" value={healthyHosts} icon={Server} />
        <MetricCard label="Issues" value={criticalHosts} changeType="negative" icon={AlertTriangle} />
        <MetricCard label="Containers" value={containers.length} change="+5" changeType="positive" icon={Box} />
        <MetricCard label="Running" value={runningContainers} icon={Activity} />
        <MetricCard label="Active Alerts" value={firingAlerts} changeType="negative" icon={Bell} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* CPU/Memory Chart */}
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Resource Usage</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />CPU</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />Memory</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metricsTimeSeries}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(190, 80%, 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(190, 80%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 16%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 20%, 10%)", border: "1px solid hsl(220, 16%, 16%)", borderRadius: "8px", fontSize: 12 }} />
              <Area type="monotone" dataKey="cpu" stroke="hsl(190, 80%, 50%)" fill="url(#cpuGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="memory" stroke="hsl(38, 92%, 50%)" fill="url(#memGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Container State */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium mb-4">Container States</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={containerStates} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                  {containerStates.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {containerStates.map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
                <span className="font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Alerts */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Recent Alerts</h3>
            <Link to="/app/alerts" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 4).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={a.severity} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.host}</div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{a.triggeredAt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Activity Feed</h3>
          </div>
          <div className="space-y-2">
            {activityFeed.slice(0, 5).map(ev => (
              <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  {ev.type === "alert" && <Bell className="h-3 w-3 text-warning" />}
                  {ev.type === "deployment" && <Rocket className="h-3 w-3 text-success" />}
                  {ev.type === "incident" && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  {ev.type === "host" && <Server className="h-3 w-3 text-muted-foreground" />}
                  {ev.type === "container" && <Box className="h-3 w-3 text-muted-foreground" />}
                  {ev.type === "member" && <Zap className="h-3 w-3 text-primary" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm truncate">{ev.message}</div>
                  <div className="text-xs text-muted-foreground">{ev.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/hosts"><Button variant="outline" size="sm" className="gap-1.5"><Server className="h-3.5 w-3.5" />Connect Host</Button></Link>
          <Link to="/app/alerts"><Button variant="outline" size="sm" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Create Alert</Button></Link>
          <Link to="/app/members"><Button variant="outline" size="sm" className="gap-1.5"><Zap className="h-3.5 w-3.5" />Invite Member</Button></Link>
          <Link to="/app/settings"><Button variant="outline" size="sm" className="gap-1.5"><Cpu className="h-3.5 w-3.5" />API Keys</Button></Link>
        </div>
      </div>
    </div>
  );
}

function Rocket(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;
}
