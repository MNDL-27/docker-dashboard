import { useMemo, useState } from "react";
import { useOrganization } from "@clerk/react";
import { BellRing, Loader2, MessageSquareShare, ServerCrash, Webhook } from "lucide-react";
import { Link } from "react-router-dom";

import { AddHostDialog } from "@/components/docker/AddHostDialog";
import { AlertsSummaryCards } from "@/components/alerts/AlertsSummaryCards";
import { ActiveAlertsTable } from "@/components/alerts/ActiveAlertsTable";
import { AlertHistoryFeed } from "@/components/alerts/AlertHistoryFeed";
import { AlertRulesPanel } from "@/components/alerts/AlertRulesPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useViewerState } from "@/hooks/useViewerState";
import { useDockerHosts } from "@/hooks/useDocker";
import { useAcknowledgeAlert, useAlertRules, useAlertsWorkspace, useCreateAlertRule, useCreateIncident, useIncidentsFeed, useResolveAlert, useUpdateAlertRule } from "@/hooks/useAlerts";
import { useSlackDestinations } from "@/hooks/useSlackDestinations";
import { useWebhookDestinations } from "@/hooks/useWebhookDestinations";
import { useToast } from "@/hooks/use-toast";
import type { AlertEvent } from "@/types/database";
import type { AlertRuleFormValues } from "@/types/alerts";

export default function AlertsPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: viewer } = useViewerState();
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);

  const hasAccess = viewer?.entitlements?.canUseAdvancedAlerts ?? false;

  const hostsQuery = useDockerHosts(currentOrg?.id, { filterByPlan: true });
  const alertsQuery = useAlertsWorkspace(currentOrg?.id, {
    severity: severityFilter === "all" ? undefined : severityFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
  }, hasAccess);
  const rulesQuery = useAlertRules(currentOrg?.id, hasAccess);
  const incidentsQuery = useIncidentsFeed(currentOrg?.id, hasAccess);
  const slackDestinationsQuery = useSlackDestinations(currentOrg?.id, hasAccess);
  const webhookDestinationsQuery = useWebhookDestinations(currentOrg?.id, hasAccess);

  const acknowledgeMutation = useAcknowledgeAlert();
  const resolveMutation = useResolveAlert();
  const createRuleMutation = useCreateAlertRule();
  const updateRuleMutation = useUpdateAlertRule();
  const createIncidentMutation = useCreateIncident();

  const alerts = alertsQuery.data?.alerts ?? [];
  const rules = rulesQuery.data ?? [];
  const incidents = incidentsQuery.data?.incidents ?? [];
  const history = incidentsQuery.data?.history ?? [];
  const slackDestinations = slackDestinationsQuery.data?.destinations ?? [];
  const webhookDestinations = webhookDestinationsQuery.data?.destinations ?? [];
  const canManage = (alertsQuery.data?.can_manage ?? false) && hasAccess;
  const summary = alertsQuery.data?.summary ?? {
    total_alerts: 0,
    critical_alerts: 0,
    enabled_rules: 0,
    open_incidents: 0,
  };

  const loading = hasAccess && (hostsQuery.isLoading || alertsQuery.isLoading || rulesQuery.isLoading || incidentsQuery.isLoading || slackDestinationsQuery.isLoading || webhookDestinationsQuery.isLoading);
  const hasHosts = (hostsQuery.data?.length ?? 0) > 0;
  const enabledSlackDestinationsCount = slackDestinations.filter((destination) => destination.enabled).length;
  const enabledWebhookDestinationsCount = webhookDestinations.filter((destination) => destination.enabled).length;
  const hasSlackRules = rules.some((rule) => rule.notification_channels.includes("slack"));
  const hasWebhookRules = rules.some((rule) => rule.notification_channels.includes("webhook"));

  const handleMutationError = (message: string, error: unknown) => {
    toast({
      title: message,
      description: error instanceof Error ? error.message : "Unknown error",
      variant: "destructive",
    });
  };

  const handleAcknowledge = async (id: string) => {
    if (!hasAccess) return;
    setPendingAlertId(id);
    try {
      await acknowledgeMutation.mutateAsync(id);
      toast({ title: "Alert acknowledged" });
    } catch (error) {
      handleMutationError("Failed to acknowledge alert", error);
    } finally {
      setPendingAlertId(null);
    }
  };

  const handleResolve = async (id: string) => {
    if (!hasAccess) return;
    setPendingAlertId(id);
    try {
      await resolveMutation.mutateAsync(id);
      toast({ title: "Alert resolved" });
    } catch (error) {
      handleMutationError("Failed to resolve alert", error);
    } finally {
      setPendingAlertId(null);
    }
  };

  const handleCreateRule = async (values: AlertRuleFormValues) => {
    if (!hasAccess) return;
    try {
      await createRuleMutation.mutateAsync(values);
      toast({ title: "Alert rule created" });
    } catch (error) {
      handleMutationError("Failed to create alert rule", error);
    }
  };

  const handleUpdateRule = async (ruleId: string, values: Partial<AlertRuleFormValues>) => {
    if (!hasAccess) return;
    try {
      await updateRuleMutation.mutateAsync({ id: ruleId, values });
      toast({ title: "Alert rule updated" });
    } catch (error) {
      handleMutationError("Failed to update alert rule", error);
    }
  };

  const handleCreateIncident = async (alert: AlertEvent & { href?: string }) => {
    if (!hasAccess) return;
    setPendingAlertId(alert.id);
    try {
      await createIncidentMutation.mutateAsync({
        alertId: alert.id,
        title: `Investigate: ${alert.title}`,
        summary: alert.message,
        severity: alert.severity,
      });
      toast({ title: "Incident created from alert" });
    } catch (error) {
      handleMutationError("Failed to create incident", error);
    } finally {
      setPendingAlertId(null);
    }
  };

  const filterLabel = useMemo(() => {
    const parts = [];
    if (severityFilter !== "all") parts.push(severityFilter);
    if (statusFilter !== "all") parts.push(statusFilter);
    return parts.length > 0 ? parts.join(" / ") : "all alerts";
  }, [severityFilter, statusFilter]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!hasAccess) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Alerts & Monitoring"
          description="Persisted alert state, rule management, and recent incident activity for your active organization."
          breadcrumbs={[{ label: "Observability" }, { label: "Alerts" }]}
        />
        <PremiumFeatureBlock
          title="Alerting & Monitoring is a paid feature"
          description="Upgrade to an Individual, Business, or Dedicated plan to configure custom alert rules, Slack/Webhook notifications, and incident tracking."
          hasAccess={false}
        >
          <div className="h-64" />
        </PremiumFeatureBlock>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Alerts & Monitoring"
        description="Persisted alert state, rule management, and recent incident activity for your active organization."
        breadcrumbs={[{ label: "Observability" }, { label: "Alerts" }]}
        actions={canManage && (viewer?.entitlements?.canUseAdvancedAlerts) ? (
          <Button onClick={() => document.getElementById("alert-rules-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <BellRing className="mr-1.5 h-4 w-4" />
            Manage Rules
          </Button>
        ) : undefined}
      />

      <PremiumFeatureBlock
        title="Alerting & Monitoring is a paid feature"
        description="Upgrade to an Individual, Business, or Dedicated plan to configure custom alert rules, Slack/Webhook notifications, and incident tracking."
        hasAccess={viewer?.entitlements?.canUseAdvancedAlerts ?? false}
      >
        {!currentOrg ? (
          <div className="glass-card">
            <EmptyState icon={ServerCrash} title="No active organization" description="Select an organization before managing alert rules and incident history." />
          </div>
        ) : !hasHosts ? (
          <div className="glass-card">
            <EmptyState
              icon={ServerCrash}
              title="Connect a host to enable alerts"
              description="Alert rules evaluate host connectivity, container lifecycle, and resource thresholds from connected Docker hosts."
              actionLabel={canManage ? "Connect your first host" : undefined}
              onAction={canManage ? () => undefined : undefined}
            />
            {canManage ? (
              <div className="pb-8 text-center">
                <AddHostDialog orgId={currentOrg.id} trigger={<Button>Connect your first host</Button>} />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <AlertsSummaryCards summary={summary} />

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium">Active view</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Currently showing {filterLabel} for the active organization.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open only</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ActiveAlertsTable
              alerts={alerts}
              canManage={canManage}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onCreateIncident={handleCreateIncident}
              pendingId={pendingAlertId}
            />

            {hasSlackRules && enabledSlackDestinationsCount === 0 ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 sm:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-full bg-warning/15 p-1.5 sm:p-2 shrink-0">
                      <MessageSquareShare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium">Slack notifications are enabled on one or more rules, but no Slack destinations are configured.</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Those rules will keep evaluating normally, but Slack messages will not be sent until an organization-level destination is added.</p>
                    </div>
                  </div>
                  {canManage ? (
                    <Button asChild size="sm" variant="outline" className="self-start mt-1 md:mt-0">
                      <Link to="/app/settings?tab=Notifications">Open Notifications</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasWebhookRules && enabledWebhookDestinationsCount === 0 ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 sm:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="rounded-full bg-warning/15 p-1.5 sm:p-2 shrink-0">
                      <Webhook className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium">Webhook delivery is enabled on one or more rules, but no destinations are configured.</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Those rules will continue evaluating normally, but outbound webhook sends will be skipped until an organization-level destination is added.</p>
                    </div>
                  </div>
                  {canManage ? (
                    <Button asChild size="sm" variant="outline" className="self-start mt-1 md:mt-0">
                      <Link to="/app/settings?tab=Webhooks">Open Webhooks</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div id="alert-rules-section">
              <AlertRulesPanel
                rules={rules}
                canManage={canManage}
                saving={createRuleMutation.isPending || updateRuleMutation.isPending}
                slackDestinationsCount={enabledSlackDestinationsCount}
                webhookDestinationsCount={enabledWebhookDestinationsCount}
                onCreate={handleCreateRule}
                onUpdate={handleUpdateRule}
              />
            </div>

            <AlertHistoryFeed incidents={incidents} history={history} />
          </>
        )}
      </PremiumFeatureBlock>
    </div>
  );
}
