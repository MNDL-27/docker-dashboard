import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { 
  Server, 
  Box, 
  Activity, 
  Loader2, 
  Plus, 
  Building2, 
  AlertCircle, 
  Globe,
  Database,
  Terminal
} from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganization, useOrganizationList } from "@clerk/clerk-react";
import { useDockerHosts, useContainers } from "@/hooks/useDocker";
import { useState, useMemo } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { HostHealthGrid } from "@/components/dashboard/HostHealthGrid";
import { FleetResourceChart } from "@/components/dashboard/FleetResourceChart";
import { ContainersTable } from "@/components/dashboard/ContainersTable";
import { DashboardAlerts, AlertItem } from "@/components/dashboard/DashboardAlerts";

export default function DashboardPage() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { createOrganization, userMemberships, isLoaded: listLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  
  const currentOrg = organization;
  const hasOrgs = userMemberships.count ? userMemberships.count > 0 : false;
  const orgLoading = !orgLoaded || !listLoaded;

  const { data: hosts = [], isLoading: hostsLoading } = useDockerHosts(currentOrg?.id);
  const { data: containers = [], isLoading: containersLoading } = useContainers(currentOrg?.id, hosts.length > 0);
  
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");

  const stats = useMemo(() => {
    const connectedHosts = hosts.filter(h => h.status === 'connected');
    const unhealthyHosts = hosts.filter(h => h.status === 'error' || h.status === 'disconnected');
    const allContainers = Array.isArray(containers) ? (containers as Record<string, any>[]) : [];
    const runningContainers = allContainers.filter((c) => c.State === 'running');
    const stoppedContainers = allContainers.filter((c) => c.State !== 'running' && c.State !== 'exited');

    // Derived alerts
    const alerts: AlertItem[] = [
      ...unhealthyHosts.map(h => ({
        id: `host-${h.id}`,
        type: 'host' as const,
        severity: 'error' as const,
        title: 'Host Disconnected',
        description: `Host "${h.name}" is unresponsive. Check agent connectivity.`,
        timestamp: h.last_seen_at ? 'Seen recently' : 'Never seen'
      })),
      ...allContainers.filter((c) => c.State === 'restarting').map(c => ({
        id: `cont-${c.Id}`,
        type: 'container' as const,
        severity: 'warning' as const,
        title: 'Container Restart Loop',
        description: `${c.Names?.[0].replace('/', '')} is restarting frequently.`,
        timestamp: 'Just now'
      }))
    ];

    return {
      hostsCount: hosts.length,
      connectedCount: connectedHosts.length,
      unhealthyCount: unhealthyHosts.length,
      containersCount: allContainers.length,
      runningCount: runningContainers.length,
      stoppedCount: stoppedContainers.length,
      alerts
    };
  }, [hosts, containers]);

  if (orgLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>;
  }

  if (!hasOrgs) {
    return (
      <div className="space-y-6 animate-fade-in p-6">
        <PageHeader title="Welcome" description="Set up your first organization to continue" />
        <div className="glass-card p-12 text-center max-w-md mx-auto border-dashed border-primary/20 bg-primary/5">
          <Building2 className="h-12 w-12 text-primary/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Create Your Organization</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">Organizations are the root of your fleet. Invite members, manage hosts, and isolate resources.</p>
          {creatingOrg ? (
            <div className="space-y-4">
              <input
                className="w-full h-11 px-4 bg-background/50 border border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                placeholder="e.g. Acme Production"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setCreatingOrg(false)}>Cancel</Button>
                <Button className="flex-1 rounded-lg" disabled={!orgName} onClick={async () => {
                   if (createOrganization) {
                     await createOrganization({ name: orgName });
                     setCreatingOrg(false);
                   }
                }}>Create</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setCreatingOrg(true)} size="lg" className="w-full gap-2 rounded-xl font-bold shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5" /> Initialize Fleet
            </Button>
          )}
        </div>
      </div>
    );
  }

  const isLoading = (hostsLoading || containersLoading) && hosts.length === 0;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary/40" /></div>;
  }

  // Empty state with CTA
  if (hosts.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in p-6">
        <PageHeader title="Dashboard" description={`Org: ${currentOrg?.name}`} />
        <div className="glass-card p-16 text-center max-w-2xl mx-auto border-primary/10 bg-primary/[0.02]">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <Server className="h-16 w-16 text-primary relative z-10" />
          </div>
          <h2 className="text-2xl font-black mb-3 tracking-tight uppercase">Fleet is empty</h2>
          <p className="text-sm text-muted-foreground mb-10 max-w-sm mx-auto leading-relaxed">
            Infrastructure management starts with a bridge. Connect your first Docker host to surface real-time insights.
          </p>
          <Link to="/app/hosts">
            <Button size="lg" className="gap-2 rounded-xl h-12 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20 group">
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" /> Connect First Host
            </Button>
          </Link>
          <div className="mt-12 grid grid-cols-3 gap-8 opacity-40">
            <div className="flex flex-col items-center gap-2">
              <Globe className="h-6 w-6" />
              <span className="text-[10px] uppercase font-bold tracking-tighter">Multi-Region</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Database className="h-6 w-6" />
              <span className="text-[10px] uppercase font-bold tracking-tighter">Real-time Stats</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Terminal className="h-6 w-6" />
              <span className="text-[10px] uppercase font-bold tracking-tighter">SSH-over-HTTP</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="p-6 pb-0">
        <PageHeader 
          title="Dashboard" 
          description={currentOrg?.name || "Overview"} 
          breadcrumbs={[{ label: "Operations" }, { label: "Fleet Summary" }]}
        />
      </div>

      <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Hosts" value={stats.hostsCount} subtext="Connected infra" icon={Server} status={stats.hostsCount > 0 ? "success" : "neutral"} />
        <KPICard label="Connected" value={stats.connectedCount} subtext="Active & healthy" status={stats.connectedCount === stats.hostsCount ? "success" : "warning"} trend={{ value: "Stable", type: "neutral" }} />
        <KPICard label="Unhealthy" value={stats.unhealthyCount} subtext="Critical attention" status={stats.unhealthyCount > 0 ? "destructive" : "success"} />
        <KPICard label="Containers" value={stats.containersCount} subtext="Total workloads" icon={Box} status="neutral" />
        <KPICard label="Running" value={stats.runningCount} subtext="Productive tasks" icon={Activity} status="success" />
        <KPICard label="Issues" value={stats.alerts.length} subtext="Active alerts" icon={AlertCircle} status={stats.alerts.length > 0 ? "destructive" : "success"} />
      </div>

      <div className="px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-[350px]">
          <HostHealthGrid hosts={hosts} />
        </div>
        <div className="lg:col-span-2 h-[350px]">
          <FleetResourceChart orgId={organization?.id ?? null} />
        </div>
      </div>

      <div className="px-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 min-h-[450px]">
          <ContainersTable containers={containers} isLoading={containersLoading} />
        </div>
        <div className="lg:col-span-1 min-h-[450px]">
          <DashboardAlerts alerts={stats.alerts} />
        </div>
      </div>
    </div>
  );
}
