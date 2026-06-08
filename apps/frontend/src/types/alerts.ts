export type AlertSeverity = "info" | "warning" | "error" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type AlertConditionType =
  | "host_offline"
  | "container_exited"
  | "container_restart_loop"
  | "cpu_usage"
  | "memory_usage";

export interface AlertRuleFormValues {
  name: string;
  condition_type: AlertConditionType;
  threshold_value: number | null;
  threshold_window_minutes: number;
  severity: AlertSeverity;
  notification_channels: string[];
  enabled: boolean;
}

export interface WebhookDestinationFormValues {
  name: string;
  url: string;
  enabled: boolean;
}

export interface SlackDestinationFormValues {
  name: string;
  webhook_url: string;
  enabled: boolean;
}
