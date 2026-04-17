import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
  Server,
  Shield,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useAddAdminOrgBan,
  useAdminAuditLog,
  useAdminHosts,
  useAdminOperations,
  useAdminOrganization,
  useAdminOrganizations,
  useAdminOverview,
  useAdminUnmatchedBillingEvents,
  useAdminMatchBillingEvent,
  useAdminDonorEmailDeliveries,
  useAdminDonorEmailDelivery,
  useAdminResendDonorEmailDelivery,
  useAdminUser,
  useAdminUsers,
  useApproveAdminUser,
  useHardDisableAdminUser,
  useHardEnableAdminUser,
  useLockAdminOrganization,
  useMarkAdminHostNeedsReconnect,
  useQuarantineAdminHost,
  useResetAdminOnboarding,
  useRevokeAdminUserApproval,
  useRunAdminSecretMigration,
  useSuspendAdminUser,
  useUnlockAdminOrganization,
  useUnquarantineAdminHost,
  useUnsuspendAdminUser,
  useUpdateAdminBilling,
} from "@/hooks/useAdmin";
import type { AdminBillingEvent, AdminBillingUpdate, AdminDonorEmailDelivery, AdminHostRow, AdminOrganizationRow, AdminUserRow } from "@/types/admin";

const tabs = ["Overview", "Users", "Organizations", "Hosts", "Billing", "Operations", "Audit Log"] as const;
type AdminTab = (typeof tabs)[number];

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function filterByQuery<T extends Record<string, unknown>>(rows: T[], query: string, keys: Array<keyof T>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    keys.some((key) => String(row[key] ?? "").toLowerCase().includes(normalized)),
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return <Badge variant={active ? "default" : "outline"}>{label}</Badge>;
}

export function AdminActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmValue,
  requireTypedConfirm = false,
  submitting,
  onConfirm,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmValue?: string;
  requireTypedConfirm?: boolean;
  submitting?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [typedValue, setTypedValue] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setTypedValue("");
    }
  }, [open]);

  const typedOk = !requireTypedConfirm || !confirmValue || typedValue === confirmValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {extra}
          {requireTypedConfirm && confirmValue ? (
            <div className="space-y-2">
              <Label htmlFor="typed-confirm">Type <span className="font-mono">{confirmValue}</span> to confirm</Label>
              <Input id="typed-confirm" value={typedValue} onChange={(event) => setTypedValue(event.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="admin-reason">Reason</Label>
            <Textarea id="admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required audit reason" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting || !reason.trim() || !typedOk}
            onClick={async () => {
              await onConfirm(reason.trim());
              onOpenChange(false);
            }}
          >
            {submitting ? "Running..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>("Overview");
  const [userQuery, setUserQuery] = useState("");
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [hostQuery, setHostQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [selectedBillingOrganizationId, setSelectedBillingOrganizationId] = useState<string | null>(null);
  const [billingForm, setBillingForm] = useState<AdminBillingUpdate>({ reason: "" });
  const [pendingAction, setPendingAction] = useState<null | { kind: string; targetId: string; title: string; description: string; confirmLabel: string; confirmValue?: string }>(null);
  const [banOrganizationId, setBanOrganizationId] = useState("");
  const [migrationScope, setMigrationScope] = useState<{ organization_id?: string; host_id?: string; dry_run?: boolean }>({});
  const [billingMatchForm, setBillingMatchForm] = useState<{ billing_event_id: string; grant_days: number; reason: string }>({
    billing_event_id: "",
    grant_days: 30,
    reason: "",
  });
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [resendReason, setResendReason] = useState("");

  const overviewQuery = useAdminOverview();
  const usersQuery = useAdminUsers();
  const organizationsQuery = useAdminOrganizations();
  const hostsQuery = useAdminHosts();
  const auditLogQuery = useAdminAuditLog();
  const operationsQuery = useAdminOperations();
  const unmatchedBillingQuery = useAdminUnmatchedBillingEvents(100);
  const donorEmailDeliveriesQuery = useAdminDonorEmailDeliveries(100);
  const donorEmailDeliveryDetailQuery = useAdminDonorEmailDelivery(selectedDeliveryId);
  const userDetailQuery = useAdminUser(selectedUserId);
  const organizationDetailQuery = useAdminOrganization(selectedOrganizationId);

  const approveMutation = useApproveAdminUser();
  const revokeApprovalMutation = useRevokeAdminUserApproval();
  const suspendMutation = useSuspendAdminUser();
  const unsuspendMutation = useUnsuspendAdminUser();
  const hardDisableMutation = useHardDisableAdminUser();
  const hardEnableMutation = useHardEnableAdminUser();
  const addOrgBanMutation = useAddAdminOrgBan();
  const lockOrgMutation = useLockAdminOrganization();
  const unlockOrgMutation = useUnlockAdminOrganization();
  const billingMutation = useUpdateAdminBilling();
  const resetOnboardingMutation = useResetAdminOnboarding();
  const quarantineMutation = useQuarantineAdminHost();
  const unquarantineMutation = useUnquarantineAdminHost();
  const reconnectMutation = useMarkAdminHostNeedsReconnect();
  const migrateSecretsMutation = useRunAdminSecretMigration();
  const matchBillingMutation = useAdminMatchBillingEvent();
  const resendDonorEmailMutation = useAdminResendDonorEmailDelivery();

  const users = filterByQuery(usersQuery.data ?? [], userQuery, ["email", "full_name"]) as AdminUserRow[];
  const organizations = filterByQuery(organizationsQuery.data ?? [], organizationQuery, ["name", "slug", "plan", "subscription_status"]) as AdminOrganizationRow[];
  const hosts = filterByQuery(hostsQuery.data ?? [], hostQuery, ["name", "organization_name", "host_url", "status"]) as AdminHostRow[];

  useEffect(() => {
    if (!selectedUserId && usersQuery.data?.[0]) setSelectedUserId(usersQuery.data[0].id);
  }, [selectedUserId, usersQuery.data]);

  useEffect(() => {
    if (!selectedOrganizationId && organizationsQuery.data?.[0]) setSelectedOrganizationId(organizationsQuery.data[0].id);
    if (!selectedBillingOrganizationId && organizationsQuery.data?.[0]) setSelectedBillingOrganizationId(organizationsQuery.data[0].id);
  }, [organizationsQuery.data, selectedBillingOrganizationId, selectedOrganizationId]);

  const selectedBillingOrganization = useMemo(
    () => organizationsQuery.data?.find((item) => item.id === selectedBillingOrganizationId) ?? null,
    [organizationsQuery.data, selectedBillingOrganizationId],
  );

  const pendingDialogSubmitting =
    approveMutation.isPending || revokeApprovalMutation.isPending || suspendMutation.isPending || unsuspendMutation.isPending ||
    hardDisableMutation.isPending || hardEnableMutation.isPending || addOrgBanMutation.isPending || lockOrgMutation.isPending ||
    unlockOrgMutation.isPending || resetOnboardingMutation.isPending || quarantineMutation.isPending ||
    unquarantineMutation.isPending || reconnectMutation.isPending;

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
          await addOrgBanMutation.mutateAsync({ userId: pendingAction.targetId, organizationId: banOrganizationId, reason });
          break;
        case "lock-organization":
          await lockOrgMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
          break;
        case "unlock-organization":
          await unlockOrgMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
          break;
        case "reset-onboarding":
          await resetOnboardingMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
          break;
        case "quarantine-host":
          await quarantineMutation.mutateAsync({ hostId: pendingAction.targetId, reason });
          break;
        case "unquarantine-host":
          await unquarantineMutation.mutateAsync({ hostId: pendingAction.targetId, reason });
          break;
        case "mark-needs-reconnect":
          await reconnectMutation.mutateAsync({ hostId: pendingAction.targetId, reason });
          break;
      }
      toast({ title: "Admin action completed" });
    } catch (error) {
      toast({ title: "Admin action failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      throw error;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Admin"
        description="Internal control plane for platform operations, tenant access, and billing overrides"
        breadcrumbs={[{ label: "Admin" }]}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as AdminTab)} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-secondary p-1">
          {tabs.map((item) => (
            <TabsTrigger key={item} value={item} className="text-xs">{item}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Overview" className="space-y-4">
          {overviewQuery.isLoading ? (
            <div className="glass-card flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="Organizations" value={overviewQuery.data?.metrics.total_organizations ?? 0} icon={Building2} />
                <MetricCard label="Users" value={overviewQuery.data?.metrics.total_users ?? 0} icon={Users} />
                <MetricCard label="Active Hosts" value={overviewQuery.data?.metrics.active_hosts ?? 0} icon={Server} />
                <MetricCard label="Suspended" value={overviewQuery.data?.metrics.suspended_users ?? 0} icon={UserX} />
                <MetricCard label="Locked Orgs" value={overviewQuery.data?.metrics.locked_organizations ?? 0} icon={Lock} />
                <MetricCard label="Quarantined Hosts" value={overviewQuery.data?.metrics.quarantined_hosts ?? 0} icon={AlertTriangle} />
              </div>

              <div className="glass-card p-5">
                <h3 className="mb-4 font-medium">Recent operations</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overviewQuery.data?.recent_operations ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.operation_name}</TableCell>
                        <TableCell><StatusPill active={!item.status.includes("error")} label={item.status} /></TableCell>
                        <TableCell>{item.scope_type ?? "global"}{item.scope_id ? `:${item.scope_id}` : ""}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{item.reason}</TableCell>
                        <TableCell>{formatDate(item.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="Users" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search users by name or email" className="pl-9" />
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
                  <TableRow key={user.id} className={selectedUserId === user.id ? "bg-muted/40" : ""} onClick={() => setSelectedUserId(user.id)}>
                    <TableCell>
                      <div className="font-medium">{user.full_name || user.email}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell><StatusPill active={user.is_approved} label={user.is_approved ? "Approved" : "Pending"} /></TableCell>
                    <TableCell><StatusPill active={!user.is_suspended && !user.is_hard_disabled} label={user.is_hard_disabled ? "Hard disabled" : user.is_suspended ? "Suspended" : "Active"} /></TableCell>
                    <TableCell>{user.organization_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="glass-card p-5">
            {userDetailQuery.isLoading ? (
              <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
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
                  <Button size="sm" variant={userDetailQuery.data.is_approved ? "outline" : "default"} onClick={() => setPendingAction({ kind: userDetailQuery.data.is_approved ? "revoke-approval" : "approve-user", targetId: userDetailQuery.data.id, title: userDetailQuery.data.is_approved ? "Revoke approval" : "Approve user", description: "This changes whether the account can access tenant routes.", confirmLabel: userDetailQuery.data.is_approved ? "Revoke approval" : "Approve user" })}>
                    <UserCheck className="mr-1.5 h-4 w-4" />
                    {userDetailQuery.data.is_approved ? "Revoke Approval" : "Approve User"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAction({ kind: userDetailQuery.data.is_suspended ? "unsuspend-user" : "suspend-user", targetId: userDetailQuery.data.id, title: userDetailQuery.data.is_suspended ? "Restore access" : "Suspend user", description: "Soft suspension blocks product access but keeps the account intact.", confirmLabel: userDetailQuery.data.is_suspended ? "Restore access" : "Suspend user" })}>
                    <Ban className="mr-1.5 h-4 w-4" />
                    {userDetailQuery.data.is_suspended ? "Restore Access" : "Suspend"}
                  </Button>
                  <Button size="sm" variant={userDetailQuery.data.is_hard_disabled ? "outline" : "destructive"} onClick={() => setPendingAction({ kind: userDetailQuery.data.is_hard_disabled ? "hard-enable-user" : "hard-disable-user", targetId: userDetailQuery.data.id, title: userDetailQuery.data.is_hard_disabled ? "Re-enable user" : "Hard disable user", description: "Hard disable also locks and bans the Clerk user.", confirmLabel: userDetailQuery.data.is_hard_disabled ? "Re-enable" : "Hard disable", confirmValue: userDetailQuery.data.email })}>
                    <Shield className="mr-1.5 h-4 w-4" />
                    {userDetailQuery.data.is_hard_disabled ? "Re-enable" : "Hard Disable"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Per-organization ban</Label>
                  <div className="flex gap-2">
                    <Select value={banOrganizationId} onValueChange={setBanOrganizationId}>
                      <SelectTrigger><SelectValue placeholder="Choose organization" /></SelectTrigger>
                      <SelectContent>
                        {userDetailQuery.data.memberships.map((membership) => (
                          <SelectItem key={membership.organization_id} value={membership.organization_id}>{membership.organization_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setPendingAction({ kind: "add-org-ban", targetId: userDetailQuery.data!.id, title: "Ban from organization", description: "This blocks the user from one organization while leaving access elsewhere intact.", confirmLabel: "Apply org ban" })}>Add Ban</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a user to inspect and manage.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="Organizations" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={organizationQuery} onChange={(event) => setOrganizationQuery(event.target.value)} placeholder="Search organizations" className="pl-9" />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => (
                  <TableRow key={organization.id} className={selectedOrganizationId === organization.id ? "bg-muted/40" : ""} onClick={() => setSelectedOrganizationId(organization.id)}>
                    <TableCell>
                      <div className="font-medium">{organization.name}</div>
                      <div className="text-xs text-muted-foreground">{organization.slug}</div>
                    </TableCell>
                    <TableCell>{organization.plan}</TableCell>
                    <TableCell>{organization.member_count}</TableCell>
                    <TableCell><StatusPill active={!organization.is_locked} label={organization.is_locked ? "Locked" : "Open"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="glass-card p-5">
            {organizationDetailQuery.isLoading ? (
              <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : organizationDetailQuery.data ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold">{organizationDetailQuery.data.name}</h3>
                  <p className="text-sm text-muted-foreground">{organizationDetailQuery.data.slug}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField label="Plan" value={organizationDetailQuery.data.plan} />
                  <DetailField label="Subscription" value={organizationDetailQuery.data.subscription_status} />
                  <DetailField label="Current Period End" value={formatDate(organizationDetailQuery.data.current_period_ends_at)} />
                  <DetailField label="Onboarding" value={organizationDetailQuery.data.onboarding_status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={organizationDetailQuery.data.is_locked ? "outline" : "destructive"} onClick={() => setPendingAction({ kind: organizationDetailQuery.data.is_locked ? "unlock-organization" : "lock-organization", targetId: organizationDetailQuery.data.id, title: organizationDetailQuery.data.is_locked ? "Unlock organization" : "Lock organization", description: "Locked organizations remain visible but tenant write actions are blocked.", confirmLabel: organizationDetailQuery.data.is_locked ? "Unlock" : "Lock" })}>
                    <Lock className="mr-1.5 h-4 w-4" />
                    {organizationDetailQuery.data.is_locked ? "Unlock" : "Lock"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingAction({ kind: "reset-onboarding", targetId: organizationDetailQuery.data.id, title: "Reset onboarding", description: "This forces the organization back into onboarding state.", confirmLabel: "Reset onboarding" })}>
                    <RefreshCcw className="mr-1.5 h-4 w-4" />
                    Reset Onboarding
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select an organization to inspect platform controls.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="Hosts" className="space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={hostQuery} onChange={(event) => setHostQuery(event.target.value)} placeholder="Search hosts" className="pl-9" />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hosts.map((host) => (
                  <TableRow key={host.id}>
                    <TableCell>
                      <div className="font-medium">{host.name}</div>
                      <div className="text-xs text-muted-foreground">{host.host_url}</div>
                    </TableCell>
                    <TableCell>{host.organization_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill active={!host.is_quarantined} label={host.is_quarantined ? "Quarantined" : host.status} />
                        {host.needs_reconnect ? <Badge variant="outline">Needs reconnect</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(host.last_seen_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPendingAction({ kind: host.is_quarantined ? "unquarantine-host" : "quarantine-host", targetId: host.id, title: host.is_quarantined ? "Unquarantine host" : "Quarantine host", description: "Quarantined hosts are blocked from proxy and control operations.", confirmLabel: host.is_quarantined ? "Unquarantine" : "Quarantine" })}>
                          {host.is_quarantined ? "Unquarantine" : "Quarantine"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPendingAction({ kind: "mark-needs-reconnect", targetId: host.id, title: "Mark host as needs reconnect", description: "Use this when the host should be surfaced to support or tenant owners as requiring attention.", confirmLabel: "Mark needs reconnect" })}>
                          Mark Needs Reconnect
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="Billing" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-card p-4">
            <Label>Organization</Label>
            <Select value={selectedBillingOrganizationId ?? ""} onValueChange={setSelectedBillingOrganizationId}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {(organizationsQuery.data ?? []).map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedBillingOrganization ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="text-sm font-medium">Provider mirror</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <DetailField label="Plan" value={selectedBillingOrganization.plan} />
                    <DetailField label="Status" value={selectedBillingOrganization.subscription_status} />
                    <DetailField label="Paddle Subscription" value={selectedBillingOrganization.paddle_subscription_id} />
                    <DetailField label="Paddle Customer" value={selectedBillingOrganization.paddle_customer_id} />
                    <DetailField label="Current Period End" value={formatDate(selectedBillingOrganization.current_period_ends_at)} />
                    <DetailField label="Donor Premium Expires" value={formatDate(selectedBillingOrganization.donor_premium_expires_at)} />
                    <DetailField label="Payment Provider" value={selectedBillingOrganization.payment_provider ?? "—"} />
                    <DetailField label="Cancel At Period End" value={selectedBillingOrganization.cancel_at_period_end ? "Yes" : "No"} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-card p-5 space-y-4">
            <h3 className="font-medium">Edit billing mirror</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={billingForm.plan ?? selectedBillingOrganization?.plan ?? "free"} onValueChange={(value) => setBillingForm((current) => ({ ...current, plan: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["free", "pro", "team", "enterprise"].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subscription status</Label>
                <Select value={billingForm.subscription_status ?? selectedBillingOrganization?.subscription_status ?? "inactive"} onValueChange={(value) => setBillingForm((current) => ({ ...current, subscription_status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["active", "inactive", "past_due", "canceled", "paused", "trialing"].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Current period end</Label>
                <Input type="datetime-local" onChange={(event) => setBillingForm((current) => ({ ...current, current_period_ends_at: event.target.value ? new Date(event.target.value).toISOString() : null }))} />
              </div>
              <div className="space-y-2">
                <Label>Cancel at period end</Label>
                <Select value={String(billingForm.cancel_at_period_end ?? selectedBillingOrganization?.cancel_at_period_end ?? false)} onValueChange={(value) => setBillingForm((current) => ({ ...current, cancel_at_period_end: value === "true" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">false</SelectItem>
                    <SelectItem value="true">true</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={billingForm.reason} onChange={(event) => setBillingForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Required audit reason" />
            </div>
            <Button
              disabled={billingMutation.isPending || !selectedBillingOrganizationId || !billingForm.reason.trim()}
              onClick={async () => {
                try {
                  await billingMutation.mutateAsync({ organizationId: selectedBillingOrganizationId!, values: billingForm });
                  toast({ title: "Billing mirror updated" });
                  setBillingForm({ reason: "" });
                } catch (error) {
                  toast({ title: "Billing update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                }
              }}
            >
              {billingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Save billing override
            </Button>

            <div className="pt-4 border-t border-border space-y-3">
              <h4 className="font-medium">Manual donor reconciliation (DNR-8)</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Unmatched event</Label>
                  <Select value={billingMatchForm.billing_event_id || "none"} onValueChange={(value) => setBillingMatchForm((current) => ({ ...current, billing_event_id: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue placeholder="Select unmatched event" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select unmatched event</SelectItem>
                      {(unmatchedBillingQuery.data ?? []).map((event: AdminBillingEvent) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.provider} · {event.provider_event_id ?? event.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="max-h-32 overflow-auto rounded-md border border-border p-2 text-xs text-muted-foreground space-y-1">
                    {(unmatchedBillingQuery.data ?? []).slice(0, 6).map((event: AdminBillingEvent) => (
                      <div key={`preview-${event.id}`} className="flex justify-between gap-2">
                        <span className="truncate">{event.provider_event_id ?? event.id.slice(0, 8)}</span>
                        <span>{event.amount ?? "—"} {event.currency ?? ""}</span>
                      </div>
                    ))}
                    {(unmatchedBillingQuery.data ?? []).length === 0 ? <div>No unmatched events</div> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Grant days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={billingMatchForm.grant_days}
                    onChange={(event) => setBillingMatchForm((current) => ({ ...current, grant_days: Number(event.target.value || 30) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={billingMatchForm.reason}
                  onChange={(event) => setBillingMatchForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Verified on PayPal/Liberapay dashboard"
                />
              </div>
              <Button
                variant="outline"
                disabled={matchBillingMutation.isPending || !billingMatchForm.billing_event_id || !selectedBillingOrganizationId || !billingMatchForm.reason.trim()}
                onClick={async () => {
                  try {
                    await matchBillingMutation.mutateAsync({
                      billing_event_id: billingMatchForm.billing_event_id,
                      organization_id: selectedBillingOrganizationId!,
                      reason: billingMatchForm.reason,
                      grant_days: billingMatchForm.grant_days,
                    });
                    toast({ title: "Donor premium granted" });
                    setBillingMatchForm({ billing_event_id: "", grant_days: 30, reason: "" });
                  } catch (error) {
                    toast({ title: "Donor match failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                  }
                }}
              >
                {matchBillingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Match event & grant premium
              </Button>

              <div className="pt-4 border-t border-border space-y-3">
                <h4 className="font-medium">Donor email delivery history</h4>
                <div className="max-h-64 overflow-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sent</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(donorEmailDeliveriesQuery.data ?? []).slice(0, 12).map((delivery: AdminDonorEmailDelivery) => (
                        <TableRow key={delivery.id} className={selectedDeliveryId === delivery.id ? "bg-muted/40" : ""} onClick={() => setSelectedDeliveryId(delivery.id)}>
                          <TableCell>{formatDate(delivery.sent_at)}</TableCell>
                          <TableCell>{delivery.template}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{delivery.organization_name}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{delivery.recipient_email}</TableCell>
                          <TableCell>
                            <StatusPill active={delivery.status === "sent" || delivery.status === "resent"} label={delivery.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(donorEmailDeliveriesQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No donor emails sent yet</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>

                {selectedDeliveryId && donorEmailDeliveryDetailQuery.data ? (
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="font-medium">Delivery details</h5>
                        <p className="text-xs text-muted-foreground">Inspect provider message ID, errors, and metadata before retrying.</p>
                      </div>
                      <StatusPill active={donorEmailDeliveryDetailQuery.data.status === "sent" || donorEmailDeliveryDetailQuery.data.status === "resent"} label={donorEmailDeliveryDetailQuery.data.status} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailField label="Organization" value={donorEmailDeliveryDetailQuery.data.organization_name} />
                      <DetailField label="Recipient" value={donorEmailDeliveryDetailQuery.data.recipient_email} />
                      <DetailField label="Template" value={donorEmailDeliveryDetailQuery.data.template} />
                      <DetailField label="Provider" value={donorEmailDeliveryDetailQuery.data.provider} />
                      <DetailField label="Provider Message ID" value={donorEmailDeliveryDetailQuery.data.provider_message_id} />
                      <DetailField label="Sent" value={formatDate(donorEmailDeliveryDetailQuery.data.sent_at)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Error</Label>
                      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                        {donorEmailDeliveryDetailQuery.data.error || "No provider error recorded"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Metadata</Label>
                      <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{JSON.stringify(donorEmailDeliveryDetailQuery.data.metadata, null, 2)}</pre>
                    </div>

                    <div className="space-y-2">
                      <Label>Retry reason</Label>
                      <Textarea value={resendReason} onChange={(event) => setResendReason(event.target.value)} placeholder="Why are you retrying this email?" />
                    </div>

                    <Button
                      variant="outline"
                      disabled={resendDonorEmailMutation.isPending || !resendReason.trim()}
                      onClick={async () => {
                        try {
                          await resendDonorEmailMutation.mutateAsync({ deliveryId: selectedDeliveryId, reason: resendReason.trim() });
                          toast({ title: "Donor email retried" });
                          setResendReason("");
                        } catch (error) {
                          toast({ title: "Retry failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                        }
                      }}
                    >
                      {resendDonorEmailMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                      Retry send with Resend
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="Operations" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><ArrowRightLeft className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-medium">Secret migration</h3>
                <p className="text-sm text-muted-foreground">Re-encrypt Docker host secrets with the active backend key, globally or against a specific org or host.</p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Organization scope</Label>
                <Select value={migrationScope.organization_id ?? "all"} onValueChange={(value) => setMigrationScope((current) => ({ ...current, organization_id: value === "all" ? undefined : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {(organizationsQuery.data ?? []).map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Host scope</Label>
                <Select value={migrationScope.host_id ?? "all"} onValueChange={(value) => setMigrationScope((current) => ({ ...current, host_id: value === "all" ? undefined : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All hosts</SelectItem>
                    {(hostsQuery.data ?? []).map((host) => (
                      <SelectItem key={host.id} value={host.id}>{host.name} ({host.organization_name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={billingForm.reason} onChange={(event) => setBillingForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Why this maintenance run is needed" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMigrationScope((current) => ({ ...current, dry_run: true }))}>Dry run next</Button>
                <Button
                  disabled={migrateSecretsMutation.isPending || !billingForm.reason.trim()}
                  onClick={async () => {
                    try {
                      await migrateSecretsMutation.mutateAsync({ ...migrationScope, reason: billingForm.reason });
                      toast({ title: "Migration operation recorded" });
                      setBillingForm({ reason: "" });
                      setMigrationScope({});
                    } catch (error) {
                      toast({ title: "Migration failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                    }
                  }}
                >
                  {migrateSecretsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                  Run migration
                </Button>
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="mb-4 font-medium">Operation history</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(operationsQuery.data ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.operation_name}</div>
                      <div className="text-xs text-muted-foreground">{item.reason}</div>
                    </TableCell>
                    <TableCell><StatusPill active={!item.status.includes("error")} label={item.status} /></TableCell>
                    <TableCell>{item.scope_type ?? "global"}{item.scope_id ? `:${item.scope_id}` : ""}</TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="Audit Log" className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditLogQuery.data ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.action}</TableCell>
                  <TableCell>{entry.actor_email}</TableCell>
                  <TableCell>{entry.target_type}:{entry.target_id}</TableCell>
                  <TableCell className="max-w-[420px] truncate">{entry.reason}</TableCell>
                  <TableCell>{formatDate(entry.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

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
        extra={pendingAction?.kind === "add-org-ban" ? (
          <div className="space-y-2">
            <Label>Organization</Label>
            <Select value={banOrganizationId} onValueChange={setBanOrganizationId}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {userDetailQuery.data?.memberships.map((membership) => (
                  <SelectItem key={membership.organization_id} value={membership.organization_id}>{membership.organization_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : undefined}
        onConfirm={runAction}
      />
    </div>
  );
}
