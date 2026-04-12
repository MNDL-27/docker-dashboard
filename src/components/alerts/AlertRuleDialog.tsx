import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AlertRule } from "@/types/database";
import type { AlertConditionType, AlertRuleFormValues, AlertSeverity } from "@/types/alerts";

const CONDITION_OPTIONS: Array<{ value: AlertConditionType; label: string }> = [
  { value: "host_offline", label: "Host offline" },
  { value: "container_exited", label: "Container exited" },
  { value: "container_restart_loop", label: "Restart loop" },
  { value: "cpu_usage", label: "CPU threshold" },
  { value: "memory_usage", label: "Memory threshold" },
];

const SEVERITY_OPTIONS: AlertSeverity[] = ["info", "warning", "error", "critical"];
const CHANNEL_OPTIONS = ["slack", "email"];

function toInitialValues(rule?: AlertRule | null): AlertRuleFormValues {
  return {
    name: rule?.name ?? "",
    condition_type: rule?.condition_type ?? "host_offline",
    threshold_value: rule?.threshold_value ?? null,
    threshold_window_minutes: rule?.threshold_window_minutes ?? 5,
    severity: rule?.severity ?? "warning",
    notification_channels: rule?.notification_channels ?? ["slack"],
    enabled: rule?.enabled ?? true,
  };
}

export function AlertRuleDialog({
  open,
  onOpenChange,
  rule,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: AlertRule | null;
  saving?: boolean;
  onSubmit: (values: AlertRuleFormValues) => void;
}) {
  const [values, setValues] = useState<AlertRuleFormValues>(toInitialValues(rule));

  useEffect(() => {
    setValues(toInitialValues(rule));
  }, [rule, open]);

  const requiresThreshold = values.condition_type === "cpu_usage" || values.condition_type === "memory_usage";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit alert rule" : "Create alert rule"}</DialogTitle>
          <DialogDescription>
            Rules are stored per organization and evaluated against connected hosts and containers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input id="rule-name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. High CPU usage" />
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={values.condition_type} onValueChange={(value) => setValues((current) => ({ ...current, condition_type: value as AlertConditionType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={values.severity} onValueChange={(value) => setValues((current) => ({ ...current, severity: value as AlertSeverity }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-window">Window (minutes)</Label>
            <Input
              id="rule-window"
              type="number"
              min={1}
              value={values.threshold_window_minutes}
              onChange={(event) => setValues((current) => ({ ...current, threshold_window_minutes: Math.max(1, Number(event.target.value) || 1) }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-threshold">Threshold</Label>
            <Input
              id="rule-threshold"
              type="number"
              value={values.threshold_value ?? ""}
              disabled={!requiresThreshold}
              placeholder={requiresThreshold ? "85" : "Not required"}
              onChange={(event) => setValues((current) => ({
                ...current,
                threshold_value: event.target.value === "" ? null : Number(event.target.value),
              }))}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Notification channels</Label>
            <div className="grid gap-3 rounded-lg border border-border bg-secondary/30 p-4 md:grid-cols-2">
              {CHANNEL_OPTIONS.map((channel) => {
                const checked = values.notification_channels.includes(channel);
                return (
                  <label key={channel} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm capitalize">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setValues((current) => ({
                          ...current,
                          notification_channels: next
                            ? [...current.notification_channels, channel]
                            : current.notification_channels.filter((item) => item !== channel),
                        }))
                      }
                    />
                    {channel}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 md:col-span-2">
            <div>
              <p className="text-sm font-medium">Rule enabled</p>
              <p className="text-xs text-muted-foreground">Disabled rules stay stored but won’t generate alerts.</p>
            </div>
            <Switch checked={values.enabled} onCheckedChange={(checked) => setValues((current) => ({ ...current, enabled: checked }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving || !values.name.trim() || values.notification_channels.length === 0}>
            {saving ? "Saving..." : rule ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
