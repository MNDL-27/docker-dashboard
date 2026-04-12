import { useState } from "react";
import { Plus, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AlertRuleDialog } from "@/components/alerts/AlertRuleDialog";
import type { AlertRule } from "@/types/database";
import type { AlertRuleFormValues } from "@/types/alerts";

function formatCondition(rule: AlertRule) {
  if (rule.condition_type === "cpu_usage") return `CPU > ${rule.threshold_value ?? 85}% for ${rule.threshold_window_minutes}m`;
  if (rule.condition_type === "memory_usage") return `Memory > ${rule.threshold_value ?? 90}% for ${rule.threshold_window_minutes}m`;
  if (rule.condition_type === "host_offline") return `Host state unhealthy for ${rule.threshold_window_minutes}m`;
  if (rule.condition_type === "container_exited") return "Container exit detected";
  return "Container restart loop detected";
}

export function AlertRulesPanel({
  rules,
  canManage,
  saving,
  webhookDestinationsCount,
  onCreate,
  onUpdate,
}: {
  rules: AlertRule[];
  canManage: boolean;
  saving?: boolean;
  webhookDestinationsCount?: number;
  onCreate: (values: AlertRuleFormValues) => void;
  onUpdate: (ruleId: string, values: Partial<AlertRuleFormValues>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const handleSubmit = (values: AlertRuleFormValues) => {
    if (editingRule) {
      onUpdate(editingRule.id, values);
    } else {
      onCreate(values);
    }
    setOpen(false);
    setEditingRule(null);
  };

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Alert Rules</h3>
            <p className="text-xs text-muted-foreground">Organization-level rules for host health, container lifecycle, and resource thresholds.</p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => { setEditingRule(null); setOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create rule
            </Button>
          ) : null}
        </div>

        <div className="divide-y divide-border">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{rule.name}</span>
                  <StatusBadge status={rule.enabled ? "running" : "paused"} />
                  <StatusBadge status={rule.severity} />
                </div>
                <div className="text-sm text-muted-foreground">{formatCondition(rule)}</div>
                <div className="text-xs text-muted-foreground">Channels: {rule.notification_channels.join(", ") || "none"}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setEditingRule(rule); setOpen(true); }}>
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}>
                      {rule.enabled ? "Pause" : "Enable"}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Read only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertRuleDialog
        open={open}
        onOpenChange={setOpen}
        rule={editingRule}
        saving={saving}
        webhookDestinationsCount={webhookDestinationsCount}
        onSubmit={handleSubmit}
      />
    </>
  );
}
