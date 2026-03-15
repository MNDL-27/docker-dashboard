import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Server, Box, Activity, Loader2, Plus, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganization, useOrganizationList } from "@clerk/clerk-react";
import { useDockerHosts, useContainers } from "@/hooks/useDocker";
import { useState } from "react";

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
  const { data: containers = [], isLoading: containersLoading } = useContainers(currentOrg?.id);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");

  if (orgLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // No org yet - prompt to create one
  if (!hasOrgs) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Welcome to Docker Dashboard" description="Get started by creating your organization" />
        <div className="glass-card p-12 text-center max-w-md mx-auto">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Create Your Organization</h2>
          <p className="text-sm text-muted-foreground mb-6">Organizations group your Docker hosts, team members, and settings.</p>
          {creatingOrg ? (
            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                placeholder="Organization name"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                autoFocus
              />
              <Button className="w-full" disabled={!orgName} onClick={async () => {
                try { 
                  if (createOrganization) {
                    await createOrganization({ name: orgName });
                    setCreatingOrg(false);
                  }
                } catch (err) {
                  console.error(err);
                }
              }}>Create Organization</Button>
            </div>
          ) : (
            <Button onClick={() => setCreatingOrg(true)} className="gap-1.5"><Plus className="h-4 w-4" />Create Organization</Button>
          )}
        </div>
      </div>
    );
  }

  const isLoading = hostsLoading || containersLoading;
  const connectedHosts = hosts.filter(h => h.status === 'connected');
  const runningContainers = Array.isArray(containers) ? containers.filter((c: any) => c.State === 'running') : [];
  const allContainers = Array.isArray(containers) ? containers : [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (hosts.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard" description={`Organization: ${currentOrg?.name}`} />
        <div className="glass-card p-12 text-center">
          <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Docker hosts connected</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your first Docker host to start monitoring containers, viewing logs, and managing your infrastructure in real time.
          </p>
          <Link to="/app/hosts"><Button className="gap-1.5"><Server className="h-4 w-4" />Connect Your First Host</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dashboard" description={`Organization: ${currentOrg?.name}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Hosts" value={hosts.length} icon={Server} />
        <MetricCard label="Connected" value={connectedHosts.length} icon={Server} changeType={connectedHosts.length === hosts.length ? "positive" : "negative"} />
        <MetricCard label="Containers" value={allContainers.length} icon={Box} />
        <MetricCard label="Running" value={runningContainers.length} icon={Activity} />
      </div>

      {/* Container summary */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Recent Containers</h3>
          <Link to="/app/containers" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {allContainers.length > 0 ? (
          <div className="space-y-1">
            {allContainers.slice(0, 8).map((c: any) => (
              <Link
                key={c.Id}
                to={`/app/containers/${c.Id?.substring(0, 12)}?host=${c._hostId}`}
                className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{(c.Names?.[0] || '').replace(/^\//, '')}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.Image}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    c.State === 'running' ? 'bg-success/15 text-success' :
                    c.State === 'exited' ? 'bg-muted text-muted-foreground' :
                    'bg-warning/15 text-warning'
                  }`}>{c.State}</span>
                  {c._hostName && <span className="text-xs text-muted-foreground hidden md:inline">{c._hostName}</span>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No containers found on connected hosts.</p>
        )}
      </div>

      {/* Host status */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Host Status</h3>
          <Link to="/app/hosts" className="text-xs text-primary hover:underline">Manage hosts</Link>
        </div>
        <div className="space-y-1">
          {hosts.map(h => (
            <Link key={h.id} to={`/app/hosts/${h.id}`} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/30 transition-colors">
              <div>
                <div className="text-sm font-medium">{h.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{h.host_url}</div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                h.status === 'connected' ? 'bg-success/15 text-success' :
                h.status === 'error' ? 'bg-destructive/15 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>{h.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
