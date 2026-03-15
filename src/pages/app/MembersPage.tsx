import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Loader2, Users } from "lucide-react";
import { useOrganization } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function MembersPage() {
  const { organization: currentOrg } = useOrganization();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members', currentOrg?.id],
    queryFn: async () => {
      return await apiFetch(`/members?orgId=${currentOrg!.id}`);
    },
    enabled: !!currentOrg,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Members"
        description="Manage team access and roles"
        breadcrumbs={[{ label: "Operations" }, { label: "Members" }]}
      />

      {members.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No members found</h3>
          <p className="text-sm text-muted-foreground">Select an organization to view its members.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Member</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.user_id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (m.full_name || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{m.full_name || 'Unknown'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><StatusBadge status={m.role} /></td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
