import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, RefreshCw, Wifi, WifiOff, Terminal, CloudCog } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganization } from "@clerk/clerk-react";
import { useDockerHosts, useDeleteDockerHost } from "@/hooks/useDocker";
import { AddHostDialog } from "@/components/docker/AddHostDialog";
import { dockerApi } from "@/services/docker-api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function HostsPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: hosts = [], isLoading, refetch } = useDockerHosts(currentOrg?.id);
  const deleteHost = useDeleteDockerHost();
  const { toast } = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleTest = async (hostId: string) => {
    setTestingId(hostId);
    try {
      const result = await dockerApi.ping(hostId);
      toast({ title: result.ok ? "✓ Connection successful" : "Connection failed", description: result.ok ? `Docker ${result.docker_version || ''}` : undefined });
      refetch();
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
      refetch();
    }
    setTestingId(null);
  };

  const handleDelete = async (hostId: string, name: string) => {
    if (!confirm(`Remove host "${name}"? This only removes it from the dashboard.`)) return;
    try {
      await deleteHost.mutateAsync(hostId);
      toast({ title: "Host removed" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Hosts"
        description={hosts.length > 0 ? `${hosts.length} host(s) configured` : "Connect Docker hosts to monitor"}
        breadcrumbs={[{ label: "Infrastructure" }, { label: "Hosts" }]}
        actions={currentOrg ? <AddHostDialog orgId={currentOrg.id} /> : undefined}
      />

      {hosts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Terminal className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Docker hosts connected</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Connect a Docker host via a lightweight agent or Cloudflare Tunnel. No open Docker ports needed.
          </p>
          {currentOrg && <AddHostDialog orgId={currentOrg.id} trigger={<Button>Connect Your First Host</Button>} />}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Host</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Mode</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">URL</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Docker</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Last Seen</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map(h => {
                const ModeIcon = h.connection_mode === 'cloudflare_tunnel' ? CloudCog : Terminal;
                const modeLabel = h.connection_mode === 'cloudflare_tunnel' ? 'CF Tunnel' : 'Agent';
                return (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="p-3">
                      <Link to={`/app/hosts/${h.id}`} className="font-medium text-primary hover:underline">{h.name}</Link>
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <ModeIcon className="h-3 w-3" />
                        {modeLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        h.status === 'connected' ? 'bg-success/15 text-success' :
                        h.status === 'unhealthy' ? 'bg-destructive/15 text-destructive' :
                        h.status === 'error' ? 'bg-warning/15 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {h.status === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {h.status}
                      </span>
                      {h.last_error && h.status !== 'connected' && (
                        <span className="block text-[10px] text-destructive/70 mt-0.5 truncate max-w-[200px]" title={h.last_error}>
                          {h.last_error}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs hidden md:table-cell">{h.host_url}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">{h.docker_version || '—'}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">
                      {h.last_seen_at ? new Date(h.last_seen_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTest(h.id)} disabled={testingId === h.id} title="Test connection">
                          {testingId === h.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(h.id, h.name)} title="Remove host">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
