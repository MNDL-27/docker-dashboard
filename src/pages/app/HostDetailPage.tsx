import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHostContainers } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import type { DockerHost } from "@/types/database";
import { Server, Box, Loader2, RefreshCw, Wifi, WifiOff, Terminal, CloudCog } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function HostDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  const { data: host, isLoading: hostLoading, refetch: refetchHost } = useQuery({
    queryKey: ['docker-host', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('docker_hosts').select('*').eq('id', id).single();
      if (error) throw error;
      return data as DockerHost;
    },
    enabled: !!id,
  });

  const { data: containers = [], isLoading: containersLoading } = useHostContainers(host?.status === 'connected' ? id : null);

  const handleTest = async () => {
    if (!id) return;
    setTesting(true);
    try {
      const result = await dockerApi.ping(id);
      toast({ title: result.ok ? "✓ Connected" : "Connection failed" });
      refetchHost();
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
      refetchHost();
    }
    setTesting(false);
  };

  if (hostLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!host) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Host not found</div>;
  }

  const realContainers = Array.isArray(containers) ? containers : [];
  const runningCount = realContainers.filter((c: any) => c.State === 'running').length;
  const ModeIcon = host.connection_mode === 'cloudflare_tunnel' ? CloudCog : Terminal;
  const modeLabel = host.connection_mode === 'cloudflare_tunnel' ? 'Cloudflare Tunnel' : 'Agent';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={host.name}
        description={host.host_url}
        breadcrumbs={[{ label: "Hosts", href: "/app/hosts" }, { label: host.name }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground inline-flex items-center gap-1">
              <ModeIcon className="h-3 w-3" />
              {modeLabel}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
              host.status === 'connected' ? 'bg-success/15 text-success' :
              host.status === 'error' ? 'bg-destructive/15 text-destructive' :
              'bg-muted text-muted-foreground'
            }`}>
              {host.status === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {host.status}
            </span>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} className="gap-1.5">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Test Connection
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Status" value={host.status} icon={Server} />
        <MetricCard label="Containers" value={realContainers.length} icon={Box} />
        <MetricCard label="Running" value={runningCount} icon={Box} />
        <MetricCard label="Docker" value={host.docker_version || 'Unknown'} icon={Server} />
      </div>

      {/* Host Details */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium mb-3">Host Details</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            ["Name", host.name],
            ["URL", host.host_url],
            ["Mode", modeLabel],
            ["Docker Version", host.docker_version || "—"],
            ["OS", host.os_info || "—"],
            ["Socket", host.docker_socket_path || "/var/run/docker.sock"],
            ["Last Seen", host.last_seen_at ? new Date(host.last_seen_at).toLocaleString() : "Never"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground text-xs">{k}</dt>
              <dd className="font-medium mt-0.5 font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Containers */}
      <div>
        <h3 className="text-sm font-medium mb-3">Containers on this host</h3>
        {host.status !== 'connected' ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">
            Host is not connected. Test the connection to fetch container data.
          </div>
        ) : containersLoading ? (
          <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : realContainers.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">No containers found on this host.</div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">Container</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs">State</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Image</th>
                  <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {realContainers.map((c: any) => (
                  <tr key={c.Id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="p-3">
                      <Link to={`/app/containers/${c.Id?.substring(0, 12)}?host=${id}`} className="font-medium text-primary hover:underline">
                        {(c.Names?.[0] || c.Id?.substring(0, 12)).replace(/^\//, '')}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.State === 'running' ? 'bg-success/15 text-success' :
                        c.State === 'exited' ? 'bg-muted text-muted-foreground' :
                        'bg-warning/15 text-warning'
                      }`}>{c.State}</span>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-xs hidden md:table-cell truncate max-w-[200px]">{c.Image}</td>
                    <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{c.Status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
