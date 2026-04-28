import { useMemo, useState } from "react";
import { useOrganization } from "@clerk/react";
import { Download, Loader2, MailPlus, MoreHorizontal, Search, Shield, UserMinus, Users } from "lucide-react";

import {
  useInviteOrganizationMember,
  useOrganizationAccess,
  useRemoveOrganizationMember,
  useResendOrganizationInvitation,
  useRevokeOrganizationInvitation,
  useUpdateOrganizationMemberRole,
} from "@/hooks/useOrganizationAccess";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  OrganizationAccessInvitation,
  OrganizationAccessMember,
  OrganizationAccessResponse,
  OrganizationInvitationFormValues,
  OrganizationMemberRole,
} from "@/types/organization-access";

type AccessRow =
  | (OrganizationAccessMember & { row_type: "member"; row_id: string; display_name: string; secondary_text: string })
  | (OrganizationAccessInvitation & { row_type: "invitation"; row_id: string; display_name: string; secondary_text: string });

const ROLE_OPTIONS: OrganizationMemberRole[] = ["owner", "admin", "member"];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function createRows(data?: OrganizationAccessResponse | null): AccessRow[] {
  if (!data) return [];

  const memberRows: AccessRow[] = data.members.map((member) => ({
    ...member,
    row_type: "member",
    row_id: member.user_id,
    display_name: member.full_name || member.email,
    secondary_text: member.email,
  }));

  const invitationRows: AccessRow[] = data.invitations.map((invitation) => ({
    ...invitation,
    row_type: "invitation",
    row_id: invitation.id,
    display_name: invitation.email,
    secondary_text: invitation.expires_at ? `Expires ${formatDate(invitation.expires_at)}` : "Pending invite",
  }));

  return [...memberRows, ...invitationRows];
}

function buildCsv(rows: AccessRow[]) {
  const lines = [
    ["name", "email", "role", "status", "joined_or_invited_at"],
    ...rows.map((row) => [
      row.display_name,
      row.email,
      row.role,
      row.status,
      row.row_type === "member" ? row.joined_at : row.created_at,
    ]),
  ];

  return lines
    .map((columns) =>
      columns
        .map((column) => `"${String(column).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

function downloadCsv(rows: AccessRow[]) {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "organization-members.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        <span className="pb-1 text-xs text-muted-foreground">{helper}</span>
      </div>
    </div>
  );
}

function InviteMemberDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  onSubmit: (values: OrganizationInvitationFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<OrganizationInvitationFormValues>({ email: "", role: "member" });

  const handleSubmit = async () => {
    await onSubmit(values);
    setValues({ email: "", role: "member" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>Send an organization invitation using the current active organization in Clerk.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={values.email}
              placeholder="teammate@example.com"
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={values.role} onValueChange={(value) => setValues((current) => ({ ...current, role: value as OrganizationMemberRole }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || !values.email.trim()} onClick={handleSubmit}>
            {saving ? "Sending..." : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationMembersWorkspaceView({
  data,
  canManage,
  isLoading,
  activeOrgName,
  inviteSaving,
  pendingMemberId,
  pendingInvitationId,
  onInvite,
  onRoleChange,
  onRemoveMember,
  onResendInvitation,
  onRevokeInvitation,
}: {
  data?: OrganizationAccessResponse | null;
  canManage: boolean;
  isLoading?: boolean;
  activeOrgName?: string | null;
  inviteSaving?: boolean;
  pendingMemberId?: string | null;
  pendingInvitationId?: string | null;
  onInvite: (values: OrganizationInvitationFormValues) => Promise<void>;
  onRoleChange: (userId: string, role: OrganizationMemberRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onResendInvitation: (id: string) => Promise<void>;
  onRevokeInvitation: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "invited">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | OrganizationMemberRole>("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const rows = useMemo(() => createRows(data), [data]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (!query) return true;
      return [row.display_name, row.email, row.secondary_text].some((value) => value.toLowerCase().includes(query));
    });
  }, [roleFilter, rows, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="glass-card flex min-h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={Users}
          title="No active organization"
          description="Select an organization to view members and invitations."
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Members" value={data.summary.members_count} helper={activeOrgName || "Active organization"} />
          <SummaryCard label="Pending Invites" value={data.summary.pending_invites_count} helper="Awaiting acceptance" />
          <SummaryCard label="Admins" value={data.summary.admins_count} helper="Owner and admin roles" />
        </div>

        <div className="glass-card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Team members</h3>
              <p className="text-xs text-muted-foreground">Manage accepted members and pending invitations for your organization.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCsv(filteredRows)} disabled={filteredRows.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
              {canManage ? (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <MailPlus className="mr-1.5 h-3.5 w-3.5" />
                  Invite member
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email"
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "active" | "invited")}>
              <SelectTrigger className="w-full lg:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | OrganizationMemberRole)}>
              <SelectTrigger className="w-full lg:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No matching members"
              description="Adjust your search or filters, or invite a teammate to get started."
              actionLabel={canManage ? "Invite member" : undefined}
              onAction={canManage ? () => setInviteOpen(true) : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined / Invited</TableHead>
                  <TableHead className="w-[72px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.row_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {"avatar_url" in row && row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
                          <AvatarFallback>{row.display_name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{row.display_name}</div>
                          <div className="text-xs text-muted-foreground">{row.secondary_text}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={row.role} /></TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {row.row_type === "member" ? formatDate(row.joined_at) : formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${row.display_name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Member actions</DropdownMenuLabel>
                            {row.row_type === "member" ? (
                              <>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {ROLE_OPTIONS.map((role) => (
                                      <DropdownMenuItem
                                        key={role}
                                        disabled={row.role === role || pendingMemberId === row.user_id}
                                        onClick={() => onRoleChange(row.user_id, role)}
                                      >
                                        {pendingMemberId === row.user_id && row.role !== role ? "Updating..." : role}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={pendingMemberId === row.user_id}
                                  onClick={() => onRemoveMember(row.user_id)}
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  {pendingMemberId === row.user_id ? "Removing..." : "Remove member"}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  disabled={pendingInvitationId === row.id}
                                  onClick={() => onResendInvitation(row.id)}
                                >
                                  {pendingInvitationId === row.id ? "Resending..." : "Resend invite"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={pendingInvitationId === row.id}
                                  onClick={() => onRevokeInvitation(row.id)}
                                >
                                  {pendingInvitationId === row.id ? "Revoking..." : "Revoke invite"}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground">Read only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        saving={inviteSaving}
        onSubmit={async (values) => {
          await onInvite(values);
          setInviteOpen(false);
        }}
      />
    </>
  );
}

export function OrganizationMembersWorkspaceContainer() {
  const { organization } = useOrganization();
  const { toast } = useToast();

  const accessQuery = useOrganizationAccess(organization?.id);
  const inviteMutation = useInviteOrganizationMember();
  const updateRoleMutation = useUpdateOrganizationMemberRole();
  const removeMemberMutation = useRemoveOrganizationMember();
  const resendInvitationMutation = useResendOrganizationInvitation();
  const revokeInvitationMutation = useRevokeOrganizationInvitation();

  const handleError = (title: string, error: unknown) => {
    toast({
      title,
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
  };

  return (
    <OrganizationMembersWorkspaceView
      data={accessQuery.data}
      canManage={accessQuery.data?.can_manage_members ?? false}
      isLoading={accessQuery.isLoading}
      activeOrgName={organization?.name}
      inviteSaving={inviteMutation.isPending}
      pendingMemberId={updateRoleMutation.isPending ? updateRoleMutation.variables?.userId : removeMemberMutation.isPending ? removeMemberMutation.variables : null}
      pendingInvitationId={
        resendInvitationMutation.isPending ? resendInvitationMutation.variables :
          revokeInvitationMutation.isPending ? revokeInvitationMutation.variables :
            null
      }
      onInvite={async (values) => {
        try {
          await inviteMutation.mutateAsync(values);
          toast({ title: "Invitation sent" });
        } catch (error) {
          handleError("Failed to send invitation", error);
          throw error;
        }
      }}
      onRoleChange={async (userId, role) => {
        try {
          await updateRoleMutation.mutateAsync({ userId, role });
          toast({ title: "Member role updated" });
        } catch (error) {
          handleError("Failed to update member role", error);
        }
      }}
      onRemoveMember={async (userId) => {
        try {
          await removeMemberMutation.mutateAsync(userId);
          toast({ title: "Member removed" });
        } catch (error) {
          handleError("Failed to remove member", error);
        }
      }}
      onResendInvitation={async (id) => {
        try {
          await resendInvitationMutation.mutateAsync(id);
          toast({ title: "Invitation resent" });
        } catch (error) {
          handleError("Failed to resend invitation", error);
        }
      }}
      onRevokeInvitation={async (id) => {
        try {
          await revokeInvitationMutation.mutateAsync(id);
          toast({ title: "Invitation revoked" });
        } catch (error) {
          handleError("Failed to revoke invitation", error);
        }
      }}
    />
  );
}
