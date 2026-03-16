import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Box } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrganization } from "@clerk/clerk-react";
import { useContainers, useDockerHosts } from "@/hooks/useDocker";

export default function ContainersPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(currentOrg?.id);
  const { data: rawContainers, isLoading: containersLoading, error } = useContainers(hosts.length > 0 ? currentOrg?.id : null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const containers = Array.isArray(rawContainers) ? rawContainers : [];
  const filtered = containers
    .filter((c: any) => {
      const name = (c.Names?.[0] || '').replace(/^\//, '').toLowerCase();
      const image = (c.Image || '').toLowerCase();
      return name.includes(search.toLowerCase()) || image.includes(search.toLowerCase());
    })
    .filter((c: any) => statusFilter === "all" || c.State === statusFilter);

  const statuses = ["all", "running", "exited", "paused", "restarting", "created"];
  const hostCount = new Set(containers.map((c: any) => c._hostId)).size;

  if (hostsLoading || containersLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Containers" breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]} />
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-destructive">Failed to load containers: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Containers"
        description={containers.length > 0 ? `${containers.length} containers across ${hostCount} host(s)` : "No containers found"}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Containers" }]}
      />

      {containers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Box className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No containers found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {hosts.length === 0 ? "Connect a Docker host first, then containers will appear here." : "No containers are currently running on your connected hosts."}
          </p>
          {hosts.length === 0 && <Link to="/app/hosts"><Button variant="outline">Go to Hosts</Button></Link>}
        </div>
      ) : (
        <>
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
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">State</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Host</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Image</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr key={c.Id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="p-3">
                      <Link to={`/app/containers/${c.Id?.substring(0, 12)}?host=${c._hostId}`} className="font-medium text-primary hover:underline">
                        {(c.Names?.[0] || (c.Id ? c.Id.substring(0, 12) : 'unknown')).replace(/^\//, '')}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.State === 'running' ? 'bg-success/15 text-success' :
                        c.State === 'exited' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/15 text-warning'
                      }`}>{c.State}</span>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{c._hostName || '—'}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell font-mono text-xs truncate max-w-[200px]">{c.Image}</td>
                    <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{c.Status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
