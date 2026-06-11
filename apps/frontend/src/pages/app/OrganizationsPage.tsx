import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, ChevronRight, Loader2, Plus, Server, Trash2, Users, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganization, useOrganizationList } from "@clerk/react";
import { useDockerHosts } from "@/hooks/useDocker";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useViewerState } from "@/hooks/useViewerState";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      return apiFetch(`/organizations?orgId=${orgId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      queryClient.invalidateQueries({ queryKey: ["docker-hosts"] });
      window.location.reload();
    },
  });
}

export default function OrganizationsPage() {
  const { userMemberships, isLoaded, createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: activeOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const organizations = userMemberships.data?.map(m => m.organization) || [];
  const { data: activeHosts = [] } = useDockerHosts(activeOrg?.id, { filterByPlan: true });
  const isLoading = !isLoaded;
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const connectedActiveHosts = activeHosts.filter(host => host.status === "connected").length;
  const totalActiveHosts = activeHosts.length;

  // Org limit enforcement
  const orgLimit = viewer?.entitlements?.orgLimit ?? 1;
  const isAtOrgLimit = orgLimit !== null && organizations.length >= orgLimit;

  // Host limit (node limit) for display
  const nodeLimit = viewer?.entitlements?.nodeLimit ?? null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (isAtOrgLimit) {
      toast({
        title: "Organization limit reached",
        description: `Your plan allows up to ${orgLimit} organization(s). Upgrade to create more.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      if (createOrganization) {
        await createOrganization({ name: newName.trim() });
        setNewName("");
        toast({
          title: "Organization created",
          description: `"${newName.trim()}" has been created successfully.`,
        });
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast({
        title: "Failed to create organization",
        description: err?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
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
          !isAtOrgLimit ? (
            <Button size="sm" className="gap-1.5" asChild>
              <a href="#create-organization">
                <Plus className="h-3.5 w-3.5" />New Organization
              </a>
            </Button>
          ) : null
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
              {organizations.length}{orgLimit !== null ? `/${orgLimit}` : ""} total
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
                helper: orgLimit === null
                  ? "Unlimited organizations allowed"
                  : orgLimit - organizations.length > 0
                    ? `You can create ${orgLimit - organizations.length} more`
                    : "Organization limit reached",
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

            {isAtOrgLimit ? (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-center gap-2 text-warning">
                  <Crown className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">Organization limit reached</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your plan allows up to {orgLimit} organization{orgLimit !== 1 ? "s" : ""}. Upgrade your plan to create more.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3 gap-1.5">
                  <Link to="/app/billing">
                    <Crown className="h-3.5 w-3.5" />Upgrade Plan
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Input
                  placeholder="Organization name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="h-10"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isCreating} className="gap-1.5">
                    {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {isCreating ? "Creating…" : "Create"}
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
            )}
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
            <OrgCard key={org.id} org={org} nodeLimit={nodeLimit} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgCard({ org, nodeLimit }: { org: { id: string; name: string; slug: string | null }; nodeLimit: number | null }) {
  // Drop `filterByPlan` here: it would cap the count using the *active* org's
  // node limit, not the target org's. Each org's host count must reflect that
  // org's own state, not the viewer's currently-selected org's entitlements.
  const { data: hosts = [] } = useDockerHosts(org.id);
  const hostCount = hosts.length;
  const deleteOrg = useDeleteOrganization();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const hasHosts = hostCount > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOrg.mutateAsync(org.id);
      toast({
        title: "Organization deleted",
        description: `"${org.name}" has been deleted.`,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast({
        title: "Failed to delete organization",
        description: err?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
            {nodeLimit !== null ? `${hostCount} / ${nodeLimit} hosts` : `${hostCount} host${hostCount !== 1 ? "s" : ""}`}
          </Badge>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/app/members">
              Manage
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                disabled={hasHosts || isDeleting}
                title={hasHosts ? "Remove all hosts before deleting" : "Delete organization"}
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{org.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the organization and all associated data
                  (alerts, members, settings). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Organization
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
