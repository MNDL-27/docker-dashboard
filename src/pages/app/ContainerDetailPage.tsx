import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { containers, metricsTimeSeries, logEntries } from "@/lib/mock-data";
import { useParams, Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { Cpu, HardDrive, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const detailTabs = ["Overview", "Metrics", "Logs", "Events", "Networking", "Config"];

export default function ContainerDetailPage() {
  const { id } = useParams();
  const container = containers.find(c => c.id === id) || containers[0];
  const [tab, setTab] = useState("Overview");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={container.name}
        description={container.image}
        breadcrumbs={[{ label: "Containers", href: "/app/containers" }, { label: container.name }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={container.status} />
            <Button size="sm" variant="outline" className="gap-1.5"><RotateCcw className="h-3 w-3" />Restart</Button>
          </div>
        }
      />

      <div className="flex gap-1 overflow-x-auto bg-secondary rounded-md p-0.5 w-fit">
        {detailTabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="CPU" value={`${container.cpu}%`} icon={Cpu} />
            <MetricCard label="Memory" value={`${container.memory} MB`} icon={HardDrive} />
            <MetricCard label="Restarts" value={container.restarts} icon={RotateCcw} changeType={container.restarts > 5 ? "negative" : "neutral"} />
            <MetricCard label="Uptime" value={container.uptime} icon={Clock} />
          </div>
          <div className="glass-card p-4">
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {[
                ["Container Name", container.name], ["Image", container.image], ["Host", container.hostName],
                ["Ports", container.ports || "None"], ["Status", container.status], ["Restarts", String(container.restarts)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="font-medium mt-0.5 font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium mb-4">Resource Usage (24h)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={metricsTimeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 16%)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220, 20%, 10%)", border: "1px solid hsl(220, 16%, 16%)", borderRadius: "8px", fontSize: 12 }} />
                <Area type="monotone" dataKey="cpu" stroke="hsl(190, 80%, 50%)" fill="none" strokeWidth={2} />
                <Area type="monotone" dataKey="memory" stroke="hsl(38, 92%, 50%)" fill="none" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {tab === "Logs" && (
        <div className="glass-card overflow-hidden font-mono text-xs">
          {logEntries.filter(l => l.container === container.name || true).slice(0, 6).map(log => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2 border-b border-border last:border-0 hover:bg-accent/30">
              <span className="text-muted-foreground shrink-0 w-20">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={`shrink-0 w-12 font-semibold uppercase ${log.severity === "error" ? "text-destructive" : log.severity === "warn" ? "text-warning" : "text-muted-foreground"}`}>{log.severity}</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
        </div>
      )}

      {(tab === "Metrics" || tab === "Events" || tab === "Networking" || tab === "Config") && (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Detailed {tab.toLowerCase()} for {container.name}</p>
        </div>
      )}
    </div>
  );
}
