export interface AdminOverview {
  metrics: {
    total_organizations: number;
    total_users: number;
    active_hosts: number;
    suspended_users: number;
    locked_organizations: number;
    quarantined_hosts: number;
  };
  recent_operations: AdminOperationRun[];
}

export interface AdminUserRow {
  id: string;
  clerk_user_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_approved: boolean;
  created_at: string;
  is_suspended: boolean;
  is_hard_disabled: boolean;
  suspension_reason: string | null;
  organization_count: number;
}

export interface AdminUserDetail extends AdminUserRow {
  internal_notes: string | null;
  memberships: Array<{
    organization_id: string;
    organization_name: string;
    role: string;
  }>;
  organization_bans: Array<{
    organization_id: string;
    organization_name: string;
    reason: string;
    created_at: string;
  }>;
}

export interface AdminOrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_price_id: string | null;
  donor_premium_expires_at: string | null;
  payment_provider: string | null;
  onboarding_status: string;
  is_locked: boolean;
  lock_reason: string | null;
  plan_override: string | null;
  subscription_status_override: string | null;
  current_period_ends_at_override: string | null;
  cancel_at_period_end_override: boolean | null;
  member_count: number;
  host_count: number;
}

export interface AdminOrganizationDetail extends Omit<AdminOrganizationRow, "member_count" | "host_count"> {
  billing_updated_at: string | null;
  onboarding_skipped_at: string | null;
  onboarding_completed_at: string | null;
  members: Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    role: string;
  }>;
  hosts: Array<{
    id: string;
    name: string;
    status: string;
    is_quarantined: boolean;
    needs_reconnect: boolean;
  }>;
  organization_bans: Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    reason: string;
    created_at: string;
  }>;
}

export interface AdminHostRow {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  status: string;
  host_url: string;
  connection_mode: string;
  last_seen_at: string | null;
  is_quarantined: boolean;
  quarantine_reason: string | null;
  needs_reconnect: boolean;
}

export interface AdminAuditEntry {
  id: string;
  actor_user_id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  request_metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminOperationRun {
  id: string;
  actor_user_id: string;
  operation_name: string;
  scope_type: string | null;
  scope_id: string | null;
  status: string;
  reason: string;
  metadata: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  created_at: string;
}

export interface AdminBillingUpdate {
  reason: string;
  plan?: string;
  subscription_status?: string;
  current_period_ends_at?: string | null;
  cancel_at_period_end?: boolean;
}

export interface AdminBillingEvent {
  id: string;
  provider: string;
  provider_event_id: string | null;
  amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  verified: boolean;
  verification_error: string | null;
  matched: boolean;
  matched_organization_id: string | null;
  matched_by: string | null;
  matched_at: string | null;
  received_at: string;
  created_at: string;
}

export interface AdminDonorEmailDelivery {
  id: string;
  organization_id: string;
  organization_name: string;
  recipient_email: string;
  template: string;
  provider: string;
  provider_message_id: string | null;
  status: string;
  error: string | null;
  metadata: Record<string, unknown>;
  sent_at: string;
  sent_on: string;
}
