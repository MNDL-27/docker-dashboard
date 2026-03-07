import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { members } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";

export default function MembersPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Members"
        description="Manage team access and roles"
        breadcrumbs={[{ label: "Operations" }, { label: "Members" }]}
        actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Invite Member</Button>}
      />
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Member</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs">Role</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Last Active</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">{m.avatar}</div>
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3"><StatusBadge status={m.role} /></td>
                <td className="p-3 text-muted-foreground hidden md:table-cell">{m.lastActive}</td>
                <td className="p-3 text-right"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
