import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, RefreshCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminOrganizations,
  useUpdateAdminBilling,
  useAdminUnmatchedBillingEvents,
  useAdminMatchBillingEvent,
  useAdminDonorEmailDeliveries,
  useAdminDonorEmailDelivery,
  useAdminResendDonorEmailDelivery,
} from "@/hooks/useAdmin";
import { DetailField, StatusPill } from "./AdminShared";
import { formatDate } from "./admin-utils";
import type { AdminBillingEvent, AdminBillingUpdate, AdminDonorEmailDelivery } from "@/types/admin";

export function AdminBillingManagement() {
  const { toast } = useToast();
  const [selectedBillingOrganizationId, setSelectedBillingOrganizationId] = useState<string | null>(null);
  const [billingForm, setBillingForm] = useState<AdminBillingUpdate>({ reason: "" });
  const [billingMatchForm, setBillingMatchForm] = useState<{
    billing_event_id: string;
    grant_days: number;
    reason: string;
  }>({
    billing_event_id: "",
    grant_days: 30,
    reason: "",
  });
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [resendReason, setResendReason] = useState("");

  const organizationsQuery = useAdminOrganizations();
  const unmatchedBillingQuery = useAdminUnmatchedBillingEvents(100);
  const donorEmailDeliveriesQuery = useAdminDonorEmailDeliveries(100);
  const donorEmailDeliveryDetailQuery = useAdminDonorEmailDelivery(selectedDeliveryId);

  const billingMutation = useUpdateAdminBilling();
  const matchBillingMutation = useAdminMatchBillingEvent();
  const resendDonorEmailMutation = useAdminResendDonorEmailDelivery();

  const selectedBillingOrganization = useMemo(
    () => organizationsQuery.data?.find((item) => item.id === selectedBillingOrganizationId) ?? null,
    [organizationsQuery.data, selectedBillingOrganizationId],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="glass-card p-4">
        <Label>Organization</Label>
        <Select value={selectedBillingOrganizationId ?? ""} onValueChange={setSelectedBillingOrganizationId}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {(organizationsQuery.data ?? []).map((organization) => (
              <SelectItem key={organization.id} value={organization.id}>
                {organization.name}
              </SelectItem>
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

                <DetailField
                  label="Current Period End"
                  value={formatDate(selectedBillingOrganization.current_period_ends_at)}
                />
                <DetailField
                  label="Donor Premium Expires"
                  value={formatDate(selectedBillingOrganization.donor_premium_expires_at)}
                />
                <DetailField label="Payment Provider" value={selectedBillingOrganization.payment_provider ?? "—"} />
                <DetailField
                  label="Cancel At Period End"
                  value={selectedBillingOrganization.cancel_at_period_end ? "Yes" : "No"}
                />
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
            <Select
              value={billingForm.plan ?? selectedBillingOrganization?.plan ?? "free"}
              onValueChange={(value) => setBillingForm((current) => ({ ...current, plan: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["free", "pro", "team", "enterprise"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subscription status</Label>
            <Select
              value={billingForm.subscription_status ?? selectedBillingOrganization?.subscription_status ?? "inactive"}
              onValueChange={(value) => setBillingForm((current) => ({ ...current, subscription_status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["active", "inactive", "past_due", "canceled", "paused", "trialing"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Current period end</Label>
            <Input
              type="datetime-local"
              onChange={(event) =>
                setBillingForm((current) => ({
                  ...current,
                  current_period_ends_at: event.target.value ? new Date(event.target.value).toISOString() : null,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Cancel at period end</Label>
            <Select
              value={String(
                billingForm.cancel_at_period_end ?? selectedBillingOrganization?.cancel_at_period_end ?? false,
              )}
              onValueChange={(value) => setBillingForm((current) => ({ ...current, cancel_at_period_end: value === "true" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">false</SelectItem>
                <SelectItem value="true">true</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Textarea
            value={billingForm.reason}
            onChange={(event) => setBillingForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Required audit reason"
          />
        </div>
        <Button
          disabled={billingMutation.isPending || !selectedBillingOrganizationId || !billingForm.reason.trim()}
          onClick={async () => {
            try {
              await billingMutation.mutateAsync({ organizationId: selectedBillingOrganizationId!, values: billingForm });
              toast({ title: "Billing mirror updated" });
              setBillingForm({ reason: "" });
            } catch (error) {
              toast({
                title: "Billing update failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
              });
            }
          }}
        >
          {billingMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Save billing override
        </Button>

        <div className="pt-4 border-t border-border space-y-3">
          <h4 className="font-medium">Manual donor reconciliation (DNR-8)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Unmatched event</Label>
              <Select
                value={billingMatchForm.billing_event_id || "none"}
                onValueChange={(value) =>
                  setBillingMatchForm((current) => ({ ...current, billing_event_id: value === "none" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unmatched event" />
                </SelectTrigger>
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
                    <span>
                      {event.amount ?? "—"} {event.currency ?? ""}
                    </span>
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
                onChange={(event) =>
                  setBillingMatchForm((current) => ({ ...current, grant_days: Number(event.target.value || 30) }))
                }
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
            disabled={
              matchBillingMutation.isPending ||
              !billingMatchForm.billing_event_id ||
              !selectedBillingOrganizationId ||
              !billingMatchForm.reason.trim()
            }
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
                toast({
                  title: "Donor match failed",
                  description: error instanceof Error ? error.message : "Unknown error",
                  variant: "destructive",
                });
              }
            }}
          >
            {matchBillingMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
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
                    <TableRow
                      key={delivery.id}
                      className={selectedDeliveryId === delivery.id ? "bg-muted/40" : ""}
                      onClick={() => setSelectedDeliveryId(delivery.id)}
                    >
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
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No donor emails sent yet
                      </TableCell>
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
                    <p className="text-xs text-muted-foreground">
                      Inspect provider message ID, errors, and metadata before retrying.
                    </p>
                  </div>
                  <StatusPill
                    active={
                      donorEmailDeliveryDetailQuery.data.status === "sent" ||
                      donorEmailDeliveryDetailQuery.data.status === "resent"
                    }
                    label={donorEmailDeliveryDetailQuery.data.status}
                  />
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
                  <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(donorEmailDeliveryDetailQuery.data.metadata, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <Label>Retry reason</Label>
                  <Textarea
                    value={resendReason}
                    onChange={(event) => setResendReason(event.target.value)}
                    placeholder="Why are you retrying this email?"
                  />
                </div>

                <Button
                  variant="outline"
                  disabled={resendDonorEmailMutation.isPending || !resendReason.trim()}
                  onClick={async () => {
                    try {
                      await resendDonorEmailMutation.mutateAsync({
                        deliveryId: selectedDeliveryId,
                        reason: resendReason.trim(),
                      });
                      toast({ title: "Donor email retried" });
                      setResendReason("");
                    } catch (error) {
                      toast({
                        title: "Retry failed",
                        description: error instanceof Error ? error.message : "Unknown error",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {resendDonorEmailMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Retry send with Resend
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
