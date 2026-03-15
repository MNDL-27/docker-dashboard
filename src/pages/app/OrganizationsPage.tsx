import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Building2, Loader2, Plus, Server } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganizationList } from "@clerk/clerk-react";
import { useDockerHosts } from "@/hooks/useDocker";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function OrganizationsPage() {
  const { userMemberships, isLoaded, createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const organizations = userMemberships.data?.map(m => m.organization) || [];
  const isLoading = !isLoaded;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      if (createOrganization) {
        await createOrganization({ name: newName.trim() });
        setNewName("");
        setCreating(false);
      }
    } catch {}
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Organizations"
        description="Manage your workspaces"
        breadcrumbs={[{ label: "Organizations" }]}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />New Organization
          </Button>
        }
      />

      {creating && (
        <div className="glass-card p-4 flex items-center gap-3 max-w-md">
          <Input placeholder="Organization name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      {organizations.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No organizations yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first organization to start managing Docker hosts.</p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Create Organization
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
  const { data: hosts = [] } = useDockerHosts(org.id);

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{org.name}</h3>
            <div className="text-xs text-muted-foreground">{org.slug} • {hosts.length} host{hosts.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>
      {hosts.length > 0 ? (
        <div className="grid md:grid-cols-3 gap-3">
          {hosts.map(host => (
            <Link key={host.id} to={`/app/hosts/${host.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors">
              <Server className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{host.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{host.status}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No hosts connected yet. Go to Hosts to add one.</p>
      )}
    </div>
  );
}
