import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hosts } from "@/lib/mock-data";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function HostsPage() {
  const [search, setSearch] = useState("");
  const filtered = hosts.filter(h => h.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Hosts"
        description={`${hosts.length} hosts connected`}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Hosts" }]}
        actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Connect Host</Button>}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search hosts..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Host</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Region</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">OS</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Docker</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs">CPU</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs">Memory</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Containers</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Last Seen</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(h => (
              <tr key={h.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                <td className="p-3">
                  <Link to={`/app/hosts/${h.id}`} className="font-medium text-primary hover:underline">{h.name}</Link>
                  <div className="text-xs text-muted-foreground">{h.ip}</div>
                </td>
                <td className="p-3"><StatusBadge status={h.status} /></td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{h.region}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{h.os}</td>
                <td className="p-3 text-muted-foreground hidden lg:table-cell">{h.dockerVersion}</td>
                <td className="p-3 text-right">
                  <span className={h.cpu > 70 ? "text-warning" : ""}>{h.cpu}%</span>
                </td>
                <td className="p-3 text-right">
                  <span className={h.memory > 75 ? "text-warning" : ""}>{h.memory}%</span>
                </td>
                <td className="p-3 text-right hidden md:table-cell">{h.containers}</td>
                <td className="p-3 text-muted-foreground hidden lg:table-cell">{h.lastSeen}</td>
                <td className="p-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
