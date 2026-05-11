import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronRight, Loader2, Plus, Server, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganization, useOrganizationList } from "@clerk/react";
import { useDockerHosts } from "@/hooks/useDocker";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function OrganizationsPage() {
  const { userMemberships, isLoaded, createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: activeOrg } = useOrganization();
  const organizations = userMemberships.data?.map(m => m.organization) || [];
  const { data: activeHosts = [] } = useDockerHosts(activeOrg?.id, { filterByPlan: true });
  const isLoading = !isLoaded;
  const [newName, setNewName] = useState("");
  const connectedActiveHosts = activeHosts.filter(host => host.status === "connected").length;
  const totalActiveHosts = activeHosts.length;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      if (createOrganization) {
        await createOrganization({ name: newName.trim() });
        setNewName("");
      }
    } catch {
      // Surface handled via toast in createOrganization; ignore here.
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Organizations"
        description="Manage your workspaces and fleet access"
        breadcrumbs={[{ label: "Organizations" }]}
        actions={
          <Button size="sm" className="gap-1.5" asChild>
            <a href="#create-organization">
              <Plus className="h-3.5 w-3.5" />New Organization
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight">Workspace overview</h3>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
              {organizations.length} total
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your organizations group hosts, alerts, and users into shared operational workspaces.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Active org",
                value: activeOrg?.name || "No active org",
                helper: activeOrg ? "Current workspace" : "Select or create one",
                icon: Building2,
              },
              {
                label: "Connected hosts",
                value: totalActiveHosts > 0 ? `${connectedActiveHosts}/${totalActiveHosts}` : "0",
                helper: totalActiveHosts > 0 ? "Connected / total in active org" : "No hosts yet",
                icon: Server,
              },
              {
                label: "Total workspaces",
                value: organizations.length,
                helper: "Organizations you belong to",
                icon: Users,
              },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-white/10 bg-background/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</div>
                  <metric.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight truncate">{metric.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{metric.helper}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div id="create-organization" className="glass-card p-6">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight">Create new organization</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Spin up a new workspace for a team or environment.</p>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Organization name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="h-10"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewName("")}>
                  Clear
                </Button>
              </div>
              {!newName.trim() ? (
                <div className="rounded-xl border border-white/10 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  Enter a name to create the organization.
                </div>
              ) : null}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold tracking-tight">Membership tips</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Invite teammates</span>
                <span className="text-foreground">From Settings → Team</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Assign roles</span>
                <span className="text-foreground">Owner / Admin / Viewer</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Switch orgs</span>
                <span className="text-foreground">Top bar org switcher</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {organizations.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No organizations yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first organization to start managing Docker hosts.</p>
          <Button size="sm" className="gap-1.5" asChild>
            <a href="#create-organization">
              <Plus className="h-3.5 w-3.5" />Create Organization
            </a>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {organizations.map(org => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgCard({ org }: { org: { id: string; name: string; slug: string | null } }) {
  const { data: hosts = [] } = useDockerHosts(org.id, { filterByPlan: true });
  const hostCount = hosts.length;

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{org.name}</h3>
            <div className="text-xs text-muted-foreground">{org.slug || "no-slug"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
            {hostCount} host{hostCount !== 1 ? "s" : ""}
          </Badge>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/app/settings">
              Manage
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent hosts</div>
          <Link to="/app/hosts" className="text-[11px] font-semibold uppercase tracking-widest text-primary hover:underline">
            View all hosts
          </Link>
        </div>
        {hosts.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {hosts.slice(0, 6).map(host => (
              <Link
                key={host.id}
                to={`/app/hosts/${host.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-background border border-white/10 hover:border-primary/30 transition-colors"
              >
                <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{host.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{host.status}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No hosts connected yet. Go to Hosts to add one.</p>
        )}
      </div>
    </div>
  );
}
