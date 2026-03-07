import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { containers } from "@/lib/mock-data";
import { Search, MoreHorizontal, RotateCcw, Square, Play, FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ContainersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filtered = containers
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.image.toLowerCase().includes(search.toLowerCase()))
    .filter(c => statusFilter === "all" || c.status === statusFilter);

  const statuses = ["all", "running", "unhealthy", "restarting", "exited", "paused"];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Containers"
        description={`${containers.length} containers across ${new Set(containers.map(c => c.hostId)).size} hosts`}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search containers or images..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${statusFilter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Container</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Host</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Image</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs">CPU</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs">Memory</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Uptime</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Restarts</th>
              <th className="p-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                <td className="p-3">
                  <Link to={`/app/containers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                  {c.ports && <div className="text-xs text-muted-foreground">{c.ports}</div>}
                </td>
                <td className="p-3"><StatusBadge status={c.status} /></td>
                <td className="p-3 hidden md:table-cell">
                  <Link to={`/app/hosts/${c.hostId}`} className="text-muted-foreground hover:text-foreground transition-colors">{c.hostName}</Link>
                </td>
                <td className="p-3 text-muted-foreground hidden lg:table-cell font-mono text-xs">{c.image}</td>
                <td className="p-3 text-right"><span className={c.cpu > 50 ? "text-warning" : ""}>{c.cpu}%</span></td>
                <td className="p-3 text-right">{c.memory} MB</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{c.uptime}</td>
                <td className="p-3 text-right hidden lg:table-cell">
                  <span className={c.restarts > 5 ? "text-destructive font-medium" : "text-muted-foreground"}>{c.restarts}</span>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Logs"><FileText className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Restart"><RotateCcw className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
