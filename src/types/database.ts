// Manual type definitions for tables added via migration

export interface Organization {
  id: string;
  name: string;
  slug: string;
  onboarding_status: 'not_started' | 'completed' | 'skipped';
  onboarding_skipped_at?: string | null;
  onboarding_completed_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'paused';
  paddle_subscription_id?: string | null;
  paddle_customer_id?: string | null;
  paddle_price_id?: string | null;
  current_period_ends_at?: string | null;
  cancel_at_period_end: boolean;
  billing_updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export type ConnectionMode = 'agent' | 'cloudflare_tunnel';

export interface DockerHost {
  id: string;
  organization_id: string;
  name: string;
  host_url: string;
  connection_mode: ConnectionMode;
  docker_socket_path: string;
  status: string;
  docker_version: string | null;
  agent_version: string | null;
  os_info: string | null;
  last_seen_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMemberProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';
export type IncidentStatus = 'open' | 'investigating' | 'resolved';
export type AlertConditionType = 'host_offline' | 'container_exited' | 'container_restart_loop' | 'cpu_usage' | 'memory_usage';

export interface AlertRule {
  id: string;
  organization_id: string;
  name: string;
  condition_type: AlertConditionType;
  resource_scope: Record<string, unknown>;
  threshold_value: number | null;
  threshold_window_minutes: number;
  severity: AlertSeverity;
  notification_channels: string[];
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AlertEvent {
  id: string;
  organization_id: string;
  rule_id: string | null;
  incident_id: string | null;
  fingerprint: string;
  source_type: 'host' | 'container' | 'metric' | 'system';
  source_ref: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  organization_id: string;
  source_alert_event_id: string | null;
  title: string;
  summary: string | null;
  severity: AlertSeverity;
  status: IncidentStatus;
  metadata: Record<string, unknown>;
  opened_by: string;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AlertDeliveryKind = 'alert' | 'test';

export interface AlertDeliveryAttempt {
  id: string;
  organization_id: string;
  webhook_destination_id: string;
  alert_event_id: string | null;
  delivery_kind: AlertDeliveryKind;
  event_type: string;
  succeeded: boolean;
  http_status: number | null;
  error_summary: string | null;
  response_excerpt: string | null;
  attempted_at: string;
  created_at: string;
}

export interface WebhookDestination {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  signing_secret_preview: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  latest_attempt?: AlertDeliveryAttempt | null;
}
