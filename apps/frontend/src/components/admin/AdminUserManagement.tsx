import { useEffect, useState } from "react";
import { Search, Loader2, UserCheck, Ban, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminUsers,
  useAdminUser,
  useApproveAdminUser,
  useRevokeAdminUserApproval,
  useSuspendAdminUser,
  useUnsuspendAdminUser,
  useHardDisableAdminUser,
  useHardEnableAdminUser,
  useAddAdminOrgBan,
} from "@/hooks/useAdmin";
import { StatusPill, DetailField, AdminActionDialog } from "./AdminShared";
import { formatDate, filterByQuery } from "./admin-utils";
import type { AdminUserRow } from "@/types/admin";

export function AdminUserManagement() {
  const { toast } = useToast();
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [banOrganizationId, setBanOrganizationId] = useState("");
  const [pendingAction, setPendingAction] = useState<null | {
    kind: string;
    targetId: string;
    title: string;
    description: string;
    confirmLabel: string;
    confirmValue?: string;
  }>(null);

  const usersQuery = useAdminUsers();
  const userDetailQuery = useAdminUser(selectedUserId);

  const approveMutation = useApproveAdminUser();
  const revokeApprovalMutation = useRevokeAdminUserApproval();
  const suspendMutation = useSuspendAdminUser();
  const unsuspendMutation = useUnsuspendAdminUser();
  const hardDisableMutation = useHardDisableAdminUser();
  const hardEnableMutation = useHardEnableAdminUser();
  const addOrgBanMutation = useAddAdminOrgBan();

  const users = filterByQuery(usersQuery.data ?? [], userQuery, ["email", "full_name"]) as AdminUserRow[];

  useEffect(() => {
    if (!selectedUserId && usersQuery.data?.[0]) setSelectedUserId(usersQuery.data[0].id);
  }, [selectedUserId, usersQuery.data]);

  const pendingDialogSubmitting =
    approveMutation.isPending ||
    revokeApprovalMutation.isPending ||
    suspendMutation.isPending ||
    unsuspendMutation.isPending ||
    hardDisableMutation.isPending ||
    hardEnableMutation.isPending ||
    addOrgBanMutation.isPending;

  const runAction = async (reason: string) => {
    if (!pendingAction) return;
    try {
      switch (pendingAction.kind) {
        case "approve-user":
          await approveMutation.mutateAsync({ userId: pendingAction.targetId, reason });
          break;
        case "revoke-approval":
          await revokeApprovalMutation.mutateAsync({ userId: pendingAction.targetId, reason });
          break;
        case "suspend-user":
          await suspendMutation.mutateAsync({ userId: pendingAction.targetId, reason });
          break;
        case "unsuspend-user":
          await unsuspendMutation.mutateAsync({ userId: pendingAction.targetId, reason });
          break;
        case "hard-disable-user":
          await hardDisableMutation.mutateAsync({ userId: pendingAction.targetId, reason });
          break;
        case "hard-enable-user":
          await hardEnableMutation.mutateAsync({ userId: pendingAction.targetId, reason });
          break;
        case "add-org-ban":
          if (!banOrganizationId) throw new Error("Select an organization first.");
          await addOrgBanMutation.mutateAsync({
            userId: pendingAction.targetId,
            organizationId: banOrganizationId,
            reason,
          });
          break;
      }
      toast({ title: "Admin action completed" });
    } catch (error) {
      toast({
        title: "Admin action failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Search users by name or email"
              className="pl-9"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Orgs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={selectedUserId === user.id ? "bg-muted/40" : ""}
                onClick={() => setSelectedUserId(user.id)}
              >
                <TableCell>
                  <div className="font-medium">{user.full_name || user.email}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>
                  <StatusPill active={user.is_approved} label={user.is_approved ? "Approved" : "Pending"} />
                </TableCell>
                <TableCell>
                  <StatusPill
                    active={!user.is_suspended && !user.is_hard_disabled}
                    label={user.is_hard_disabled ? "Hard disabled" : user.is_suspended ? "Suspended" : "Active"}
                  />
                </TableCell>
                <TableCell>{user.organization_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="glass-card p-5">
        {userDetailQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : userDetailQuery.data ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold">{userDetailQuery.data.full_name || userDetailQuery.data.email}</h3>
              <p className="text-sm text-muted-foreground">{userDetailQuery.data.email}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Approved" value={userDetailQuery.data.is_approved ? "Yes" : "No"} />
              <DetailField label="Created" value={formatDate(userDetailQuery.data.created_at)} />
              <DetailField label="Suspended" value={userDetailQuery.data.is_suspended ? "Yes" : "No"} />
              <DetailField label="Hard Disabled" value={userDetailQuery.data.is_hard_disabled ? "Yes" : "No"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={userDetailQuery.data.is_approved ? "outline" : "default"}
                onClick={() =>
                  setPendingAction({
                    kind: userDetailQuery.data!.is_approved ? "revoke-approval" : "approve-user",
                    targetId: userDetailQuery.data!.id,
                    title: userDetailQuery.data!.is_approved ? "Revoke approval" : "Approve user",
                    description: "This changes whether the account can access tenant routes.",
                    confirmLabel: userDetailQuery.data!.is_approved ? "Revoke approval" : "Approve user",
                  })
                }
              >
                <UserCheck className="mr-1.5 h-4 w-4" />
                {userDetailQuery.data.is_approved ? "Revoke Approval" : "Approve User"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPendingAction({
                    kind: userDetailQuery.data!.is_suspended ? "unsuspend-user" : "suspend-user",
                    targetId: userDetailQuery.data!.id,
                    title: userDetailQuery.data!.is_suspended ? "Restore access" : "Suspend user",
                    description: "Soft suspension blocks product access but keeps the account intact.",
                    confirmLabel: userDetailQuery.data!.is_suspended ? "Restore access" : "Suspend user",
                  })
                }
              >
                <Ban className="mr-1.5 h-4 w-4" />
                {userDetailQuery.data.is_suspended ? "Restore Access" : "Suspend"}
              </Button>
              <Button
                size="sm"
                variant={userDetailQuery.data.is_hard_disabled ? "outline" : "destructive"}
                onClick={() =>
                  setPendingAction({
                    kind: userDetailQuery.data!.is_hard_disabled ? "hard-enable-user" : "hard-disable-user",
                    targetId: userDetailQuery.data!.id,
                    title: userDetailQuery.data!.is_hard_disabled ? "Re-enable user" : "Hard disable user",
                    description: "Hard disable also locks and bans the Clerk user.",
                    confirmLabel: userDetailQuery.data!.is_hard_disabled ? "Re-enable" : "Hard disable",
                    confirmValue: userDetailQuery.data!.email,
                  })
                }
              >
                <Shield className="mr-1.5 h-4 w-4" />
                {userDetailQuery.data.is_hard_disabled ? "Re-enable" : "Hard Disable"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Per-organization ban</Label>
              <div className="flex gap-2">
                <Select value={banOrganizationId} onValueChange={setBanOrganizationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {userDetailQuery.data.memberships.map((membership) => (
                      <SelectItem key={membership.organization_id} value={membership.organization_id}>
                        {membership.organization_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() =>
                    setPendingAction({
                      kind: "add-org-ban",
                      targetId: userDetailQuery.data!.id,
                      title: "Ban from organization",
                      description: "This blocks the user from one organization while leaving access elsewhere intact.",
                      confirmLabel: "Apply org ban",
                    })
                  }
                >
                  Add Ban
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select a user to inspect and manage.</div>
        )}
      </div>

      <AdminActionDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={pendingAction?.title ?? ""}
        description={pendingAction?.description ?? ""}
        confirmLabel={pendingAction?.confirmLabel ?? "Confirm"}
        confirmValue={pendingAction?.confirmValue}
        requireTypedConfirm={Boolean(pendingAction?.confirmValue)}
        submitting={pendingDialogSubmitting}
        extra={
          pendingAction?.kind === "add-org-ban" ? (
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={banOrganizationId} onValueChange={setBanOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {userDetailQuery.data?.memberships.map((membership) => (
                    <SelectItem key={membership.organization_id} value={membership.organization_id}>
                      {membership.organization_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : undefined
        }
        onConfirm={runAction}
      />
    </div>
  );
}
