import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { hosts, containers, metricsTimeSeries } from "@/lib/mock-data";
import { useParams, Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { Server, Cpu, HardDrive, Box } from "lucide-react";

const detailTabs = ["Overview", "Containers", "Metrics", "Events", "Logs", "Agent"];

export default function HostDetailPage() {
  const { id } = useParams();
  const host = hosts.find(h => h.id === id) || hosts[0];
  const hostContainers = containers.filter(c => c.hostId === host.id);
  const [tab, setTab] = useState("Overview");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={host.name}
        description={`${host.ip} • ${host.region} • ${host.os}`}
        breadcrumbs={[{ label: "Hosts", href: "/app/hosts" }, { label: host.name }]}
        actions={<StatusBadge status={host.status} />}
      />

      <div className="flex gap-1 overflow-x-auto bg-secondary rounded-md p-0.5 w-fit">
        {detailTabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="CPU Usage" value={`${host.cpu}%`} icon={Cpu} changeType={host.cpu > 70 ? "negative" : "neutral"} />
            <MetricCard label="Memory" value={`${host.memory}%`} icon={HardDrive} />
            <MetricCard label="Containers" value={host.containers} icon={Box} />
            <MetricCard label="Agent Version" value={host.agentVersion} icon={Server} />
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium mb-4">CPU & Memory (24h)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metricsTimeSeries}>
                <defs>
                  <linearGradient id="hostCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(190, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(190, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 16%)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 12%, 30%)" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220, 20%, 10%)", border: "1px solid hsl(220, 16%, 16%)", borderRadius: "8px", fontSize: 12 }} />
                <Area type="monotone" dataKey="cpu" stroke="hsl(190, 80%, 50%)" fill="url(#hostCpu)" strokeWidth={2} />
                <Area type="monotone" dataKey="memory" stroke="hsl(38, 92%, 50%)" fill="none" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3">Host Details</h3>
            <div className="glass-card p-4">
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {[
                  ["Hostname", host.name], ["IP Address", host.ip], ["Region", host.region],
                  ["OS", host.os], ["Docker Version", host.dockerVersion], ["Agent Version", host.agentVersion],
                  ["Last Seen", host.lastSeen], ["Containers", String(host.containers)], ["Status", host.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground text-xs">{k}</dt>
                    <dd className="font-medium mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </>
      )}

      {tab === "Containers" && (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Container</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs">CPU</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs">Memory</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Uptime</th>
              </tr>
            </thead>
            <tbody>
              {hostContainers.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                  <td className="p-3">
                    <Link to={`/app/containers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                    <div className="text-xs text-muted-foreground font-mono">{c.image}</div>
                  </td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-right">{c.cpu}%</td>
                  <td className="p-3 text-right">{c.memory} MB</td>
                  <td className="p-3 text-muted-foreground">{c.uptime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === "Metrics" || tab === "Events" || tab === "Logs" || tab === "Agent") && (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Detailed {tab.toLowerCase()} view for {host.name}</p>
        </div>
      )}
    </div>
  );
}
