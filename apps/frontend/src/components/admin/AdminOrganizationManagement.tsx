import { useEffect, useState } from "react";
import { Search, Loader2, Lock, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminOrganizations,
  useAdminOrganization,
  useLockAdminOrganization,
  useUnlockAdminOrganization,
  useResetAdminOnboarding,
  useSendAdminRenewalReminder,
} from "@/hooks/useAdmin";
import { StatusPill, DetailField, AdminActionDialog } from "./AdminShared";
import { formatDate, filterByQuery } from "./admin-utils";
import type { AdminOrganizationRow } from "@/types/admin";

export function AdminOrganizationManagement() {
  const { toast } = useToast();
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | {
    kind: string;
    targetId: string;
    title: string;
    description: string;
    confirmLabel: string;
  }>(null);

  const organizationsQuery = useAdminOrganizations();
  const organizationDetailQuery = useAdminOrganization(selectedOrganizationId);

  const lockOrgMutation = useLockAdminOrganization();
  const unlockOrgMutation = useUnlockAdminOrganization();
  const resetOnboardingMutation = useResetAdminOnboarding();
  const sendRenewalReminderMutation = useSendAdminRenewalReminder();

  const organizations = filterByQuery(organizationsQuery.data ?? [], organizationQuery, [
    "name",
    "slug",
    "plan",
    "subscription_status",
  ]) as AdminOrganizationRow[];

  useEffect(() => {
    if (!selectedOrganizationId && organizationsQuery.data?.[0]) setSelectedOrganizationId(organizationsQuery.data[0].id);
  }, [organizationsQuery.data, selectedOrganizationId]);

  const pendingDialogSubmitting =
    lockOrgMutation.isPending || unlockOrgMutation.isPending || resetOnboardingMutation.isPending || sendRenewalReminderMutation.isPending;

  const runAction = async (reason: string) => {
    if (!pendingAction) return;
    try {
      switch (pendingAction.kind) {
        case "lock-organization":
          await lockOrgMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
          break;
        case "unlock-organization":
          await unlockOrgMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
          break;
        case "reset-onboarding":
          await resetOnboardingMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
          break;
        case "send-renewal-reminder":
          await sendRenewalReminderMutation.mutateAsync({ organizationId: pendingAction.targetId, reason });
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
              value={organizationQuery}
              onChange={(event) => setOrganizationQuery(event.target.value)}
              placeholder="Search organizations"
              className="pl-9"
            />
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
              <TableRow
                key={organization.id}
                className={selectedOrganizationId === organization.id ? "bg-muted/40" : ""}
                onClick={() => setSelectedOrganizationId(organization.id)}
              >
                <TableCell>
                  <div className="font-medium">{organization.name}</div>
                  <div className="text-xs text-muted-foreground">{organization.slug}</div>
                </TableCell>
                <TableCell>{organization.plan}</TableCell>
                <TableCell>{organization.member_count}</TableCell>
                <TableCell>
                  <StatusPill active={!organization.is_locked} label={organization.is_locked ? "Locked" : "Open"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="glass-card p-5">
        {organizationDetailQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
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
              <Button
                size="sm"
                variant={organizationDetailQuery.data.is_locked ? "outline" : "destructive"}
                onClick={() =>
                  setPendingAction({
                    kind: organizationDetailQuery.data!.is_locked ? "unlock-organization" : "lock-organization",
                    targetId: organizationDetailQuery.data!.id,
                    title: organizationDetailQuery.data!.is_locked ? "Unlock organization" : "Lock organization",
                    description: "Locked organizations remain visible but tenant write actions are blocked.",
                    confirmLabel: organizationDetailQuery.data!.is_locked ? "Unlock" : "Lock",
                  })
                }
              >
                <Lock className="mr-1.5 h-4 w-4" />
                {organizationDetailQuery.data.is_locked ? "Unlock" : "Lock"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPendingAction({
                    kind: "reset-onboarding",
                    targetId: organizationDetailQuery.data!.id,
                    title: "Reset onboarding",
                    description: "This forces the organization back into onboarding state.",
                    confirmLabel: "Reset onboarding",
                  })
                }
              >
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                Reset Onboarding
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPendingAction({
                    kind: "send-renewal-reminder",
                    targetId: organizationDetailQuery.data!.id,
                    title: "Send Renewal Reminder",
                    description: "This will manually trigger the automated donor premium renewal reminder to the organization's billing contacts.",
                    confirmLabel: "Send Reminder",
                  })
                }
              >
                Send Renewal Reminder
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Select an organization to inspect platform controls.</div>
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
        submitting={pendingDialogSubmitting}
        onConfirm={runAction}
      />
    </div>
  );
}
