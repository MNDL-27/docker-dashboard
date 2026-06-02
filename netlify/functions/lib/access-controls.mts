import { sql } from "./db.mjs";
import { ensureAdminSchema } from "./ensure-admin-schema.mjs";
import { ensureNotificationsSchema } from "./ensure-notifications-schema.mjs";
import { isDonorPremiumActive } from "./donor-billing.mjs";
import {
  PLAN_POLICY_BY_PLAN,
  getEffectivePlanForEnforcement,
  normalizePlan,
  normalizeSubscriptionStatus,
  isPaidSubscriptionStatus,
  type PlanId,
  type SubscriptionStatus,
} from "../../../shared/schema/plan-policy.ts";

function requiresPlatformApproval() {
  const value = (process.env.REQUIRE_PLATFORM_APPROVALS || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export interface UserAccessControl {
  is_suspended: boolean;
  is_hard_disabled: boolean;
  suspension_reason: string | null;
  internal_notes: string | null;
}

export interface OrganizationAccessControl {
  is_locked: boolean;
  lock_reason: string | null;
  plan_override: string | null;
  subscription_status_override: string | null;
  current_period_ends_at_override: string | null;
  cancel_at_period_end_override: boolean | null;
}

export interface DockerHostAdminControl {
  is_quarantined: boolean;
  quarantine_reason: string | null;
  needs_reconnect: boolean;
}

export interface OrganizationEntitlements {
  plan: PlanId;
  effectivePlan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  isPaidSubscriptionActive: boolean;
  isDonorPremium: boolean;
  seatLimit: number | null;
  nodeLimit: number | null;
  logTailLines: number;
  maxPayloadBytes: number;
  canUseWebhookDestinations: boolean;
  canUseSlackDestinations: boolean;
  canUseAdvancedAlerts: boolean;
  canUseTeamCollaboration: boolean;
  canUseLogs: boolean;
  canUseFileManager: boolean;
}

type OrganizationFeature =
  | "webhook_destinations"
  | "slack_destinations"
  | "advanced_alerts"
  | "team_collaboration"
  | "logs"
  | "file_manager";

const HOST_LIMIT_EXCEEDED_ERROR =
  "Host is inactive because your current plan limit has been exceeded. Remove extra hosts or upgrade to re-enable this host.";

/**
 * Insert an in-app notification for the organization so users see a bell
 * indicator and toast explaining that some hosts were locked.
 */
async function createHostLimitNotification({
  organizationId,
  blockedCount,
  nodeLimit,
}: {
  organizationId: string;
  blockedCount: number;
  nodeLimit: number;
}) {
  await ensureNotificationsSchema();

  // Dedup: only create one notification per downgrade event — skip if a
  // plan_downgrade notification already exists and hasn't expired yet.
  const [existing] = await sql`
    SELECT id FROM public.notifications
    WHERE organization_id = ${organizationId}
      AND metadata @> ${JSON.stringify({ source: 'plan_downgrade' })}::jsonb
      AND expires_at > now()
    LIMIT 1
  `;
  if (existing) return;

  const hostLabel = blockedCount === 1 ? "host was" : "hosts were";
  const limitLabel = nodeLimit === 1 ? "1 host" : `${nodeLimit} hosts`;

  await sql`
    INSERT INTO public.notifications (
      organization_id,
      title,
      message,
      type,
      link,
      metadata,
      expires_at
    )
    VALUES (
      ${organizationId},
      ${`${blockedCount} ${hostLabel} deactivated`},
      ${`Your plan allows ${limitLabel}. ${blockedCount} of ${blockedCount + nodeLimit} host(s) were deactivated. Upgrade your plan or remove extra hosts to regain access.`},
      'warning',
      '/pricing',
      ${JSON.stringify({
        blocked_count: blockedCount,
        node_limit: nodeLimit,
        source: 'plan_downgrade',
      })}::jsonb,
      now() + interval '30 days'
    )
  `;
}

/**
 * Compute entitlements purely from the organization's plan.
 * The plan is the absolute source of truth — isPlatformAdmin is accepted
 * for signature compatibility but intentionally ignored here.
 * Admin privileges only bypass user-level access checks (suspension,
 * org locks, host quarantine) elsewhere in this module; they never
 * inflate plan capacity or unlock paid features.
 */
export function computeOrganizationEntitlements({
  plan,
  subscriptionStatus,
  isDonorPremium,
  isPlatformAdmin,
}: {
  plan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  isDonorPremium: boolean;
  isPlatformAdmin: boolean;
}): OrganizationEntitlements {
  const normalizedPlan = normalizePlan(plan);
  const normalizedStatus = normalizeSubscriptionStatus(subscriptionStatus);

  const isPaidPlan = normalizedPlan !== "free";
  const isPaidSubscriptionActive = isPaidPlan && isPaidSubscriptionStatus(normalizedStatus);
  
  // FORCE STRICT LIMITS FOR ADMINS ON FREE PLAN
  // This allows the developer to experience the 1-host limit exactly as
  // a free user would, without donor overrides getting in the way.
  const forceStrictFreePlan = isPlatformAdmin && normalizedPlan === "free";

  const effectivePlan = getEffectivePlanForEnforcement({
    plan: normalizedPlan,
    subscriptionStatus: normalizedStatus,
    isDonorPremium,
    forceStrictFreePlan,
  });
  const paidTierPolicy = PLAN_POLICY_BY_PLAN[effectivePlan];

  // If we are forcing strict limits, we must also ignore the donor status
  // for individual feature flags.
  const activeDonorStatus = forceStrictFreePlan ? false : isDonorPremium;

  // Platform Admins can bypass user-level access checks (suspension, org locks)
  // but they are now subject to the organization's plan limits for capacity
  // and features. This allows testing the system as a regular user while
  // maintaining management access where it counts.
  if (isPlatformAdmin) {
    return {
      plan: normalizedPlan,
      effectivePlan,
      subscriptionStatus: normalizedStatus,
      isPaidSubscriptionActive,
      isDonorPremium: activeDonorStatus,
      // Admins are still subject to plan limits
      seatLimit: paidTierPolicy.seatLimit,
      nodeLimit: paidTierPolicy.nodeLimit,
      logTailLines: paidTierPolicy.logTailLines,
      maxPayloadBytes: paidTierPolicy.maxPayloadBytes,
      canUseWebhookDestinations: paidTierPolicy.canUseWebhookDestinations,
      canUseSlackDestinations: paidTierPolicy.canUseSlackDestinations,
      canUseAdvancedAlerts: paidTierPolicy.canUseAdvancedAlerts || activeDonorStatus,
      canUseTeamCollaboration: paidTierPolicy.canUseTeamCollaboration,
      canUseLogs: paidTierPolicy.canUseLogs || activeDonorStatus,
      canUseFileManager: paidTierPolicy.canUseFileManager,
    };
  }

  return {
    plan: normalizedPlan,
    effectivePlan,
    subscriptionStatus: normalizedStatus,
    isPaidSubscriptionActive,
    isDonorPremium: activeDonorStatus,
    seatLimit: paidTierPolicy.seatLimit,
    nodeLimit: paidTierPolicy.nodeLimit,
    logTailLines: paidTierPolicy.logTailLines,
    maxPayloadBytes: paidTierPolicy.maxPayloadBytes,
    canUseWebhookDestinations: paidTierPolicy.canUseWebhookDestinations,
    canUseSlackDestinations: paidTierPolicy.canUseSlackDestinations,
    canUseAdvancedAlerts: paidTierPolicy.canUseAdvancedAlerts || activeDonorStatus,
    canUseTeamCollaboration: paidTierPolicy.canUseTeamCollaboration,
    canUseLogs: paidTierPolicy.canUseLogs || activeDonorStatus,
    canUseFileManager: paidTierPolicy.canUseFileManager,
  };
}

export async function resolveOrganizationEntitlements({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}): Promise<OrganizationEntitlements> {
  await ensureAdminSchema();

  const [organization] = await sql<
    Array<{
      plan: string | null;
      subscription_status: string | null;
    }>
  >`
    SELECT plan, subscription_status
    FROM public.organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `;

  if (!organization) {
    throw new Error("Organization not found");
  }

  const control = await getOrganizationAccessControl(organizationId);

  const { active: isDonorPremium } = await isDonorPremiumActive(organizationId);

  return computeOrganizationEntitlements({
    plan: control.plan_override ?? organization.plan,
    subscriptionStatus: control.subscription_status_override ?? organization.subscription_status,
    isDonorPremium,
    isPlatformAdmin,
  });
}

export async function assertOrganizationFeatureAllowed({
  organizationId,
  isPlatformAdmin,
  feature,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
  feature: OrganizationFeature;
}) {
  const entitlements = await resolveOrganizationEntitlements({ organizationId, isPlatformAdmin });

  const allowedByFeature: Record<OrganizationFeature, boolean> = {
    webhook_destinations: entitlements.canUseWebhookDestinations,
    slack_destinations: entitlements.canUseSlackDestinations,
    advanced_alerts: entitlements.canUseAdvancedAlerts,
    team_collaboration: entitlements.canUseTeamCollaboration,
    logs: entitlements.canUseLogs,
    file_manager: entitlements.canUseFileManager,
  };

  if (allowedByFeature[feature]) {
    return entitlements;
  }

  const messages: Record<OrganizationFeature, string> = {
    webhook_destinations: "Webhook destinations require an Individual, Business, or Dedicated subscription.",
    slack_destinations: "Slack destinations require a Business or Dedicated subscription.",
    advanced_alerts: "Advanced Alert Rules require an Individual, Business, or Dedicated subscription.",
    team_collaboration: "Team collaboration requires a Business or Dedicated subscription.",
    logs: "Container logs require an Individual, Business, or Dedicated subscription.",
    file_manager: "The File Manager requires an Individual, Business, or Dedicated subscription.",
  };

  throw new Error(messages[feature]);
}

export async function assertOrganizationNodeCapacityAvailable({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}) {
  const entitlements = await resolveOrganizationEntitlements({ organizationId, isPlatformAdmin });
  if (entitlements.nodeLimit === null) {
    return entitlements;
  }

  const [{ count }] = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM public.docker_hosts
    WHERE organization_id = ${organizationId}
  `;

  const nodeCount = Number.parseInt(count ?? "0", 10);
  if (Number.isFinite(nodeCount) && nodeCount < entitlements.nodeLimit) {
    return entitlements;
  }

  throw new Error(`This plan allows up to ${entitlements.nodeLimit} connected host(s). Upgrade to add more hosts.`);
}

export async function enforceOrganizationNodeLimit({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}) {
  const entitlements = await resolveOrganizationEntitlements({ organizationId, isPlatformAdmin });

  const hosts = await sql<Array<{ id: string }>>`
    SELECT id
    FROM public.docker_hosts
    WHERE organization_id = ${organizationId}
    ORDER BY created_at ASC, id ASC
  `;

  if (entitlements.nodeLimit === null) {
    return {
      entitlements,
      allowedHostIds: hosts.map((host) => host.id),
      blockedHostIds: [] as string[],
    };
  }

  const allowedHostIds = hosts.slice(0, entitlements.nodeLimit).map((host) => host.id);
  const blockedHostIds = hosts.slice(entitlements.nodeLimit).map((host) => host.id);

  if (blockedHostIds.length > 0) {
    await sql`
      UPDATE public.docker_hosts
      SET
        status = 'disconnected',
        last_error = ${HOST_LIMIT_EXCEEDED_ERROR},
        consecutive_failures = GREATEST(COALESCE(consecutive_failures, 0), 1)
      WHERE id = ANY(${blockedHostIds})
    `;

    // Notify users via in-app notification so they see a bell indicator
    // explaining why hosts were deactivated. Dedup is handled inside
    // createHostLimitNotification to avoid duplicates per downgrade event.
    await createHostLimitNotification({
      organizationId,
      blockedCount: blockedHostIds.length,
      nodeLimit: entitlements.nodeLimit!,
    });
  }

  if (allowedHostIds.length > 0) {
    await sql`
      UPDATE public.docker_hosts
      SET
        last_error = NULL,
        consecutive_failures = 0
      WHERE id = ANY(${allowedHostIds})
        AND last_error = ${HOST_LIMIT_EXCEEDED_ERROR}
    `;
  }

  return {
    entitlements,
    allowedHostIds,
    blockedHostIds,
  };
}

export async function assertOrganizationSeatCapacityAvailable({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}) {
  const entitlements = await resolveOrganizationEntitlements({ organizationId, isPlatformAdmin });
  if (entitlements.seatLimit === null) {
    return entitlements;
  }

  const [{ count }] = await sql<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM public.organization_members
    WHERE organization_id = ${organizationId}
  `;

  const memberCount = Number.parseInt(count ?? "0", 10);
  if (Number.isFinite(memberCount) && memberCount < entitlements.seatLimit) {
    return entitlements;
  }

  throw new Error(`This plan allows up to ${entitlements.seatLimit} seat(s). Upgrade for team access.`);
}

export async function getUserAccessControl(userId: string): Promise<UserAccessControl> {
  await ensureAdminSchema();
  const rows = await sql<UserAccessControl[]>`
    SELECT
      is_suspended,
      is_hard_disabled,
      suspension_reason,
      internal_notes
    FROM public.user_access_controls
    WHERE user_id = ${userId}
  `;

  return rows[0] ?? {
    is_suspended: false,
    is_hard_disabled: false,
    suspension_reason: null,
    internal_notes: null,
  };
}

export async function getOrganizationAccessControl(organizationId: string): Promise<OrganizationAccessControl> {
  await ensureAdminSchema();
  const rows = await sql<OrganizationAccessControl[]>`
    SELECT
      is_locked,
      lock_reason,
      plan_override,
      subscription_status_override,
      current_period_ends_at_override::text,
      cancel_at_period_end_override
    FROM public.organization_access_controls
    WHERE organization_id = ${organizationId}
  `;

  return rows[0] ?? {
    is_locked: false,
    lock_reason: null,
    plan_override: null,
    subscription_status_override: null,
    current_period_ends_at_override: null,
    cancel_at_period_end_override: null,
  };
}

export async function getDockerHostAdminControl(hostId: string): Promise<DockerHostAdminControl> {
  await ensureAdminSchema();
  const rows = await sql<DockerHostAdminControl[]>`
    SELECT
      is_quarantined,
      quarantine_reason,
      needs_reconnect
    FROM public.docker_host_admin_controls
    WHERE host_id = ${hostId}
  `;

  return rows[0] ?? {
    is_quarantined: false,
    quarantine_reason: null,
    needs_reconnect: false,
  };
}

export async function isUserBannedFromOrganization(userId: string, organizationId: string): Promise<boolean> {
  await ensureAdminSchema();
  const rows = await sql`
    SELECT 1
    FROM public.organization_user_bans
    WHERE user_id = ${userId} AND organization_id = ${organizationId}
    LIMIT 1
  `;

  return rows.length > 0;
}

export async function assertTenantAccessAllowed({
  userId,
  organizationId,
  isPlatformAdmin,
  isApproved,
}: {
  userId: string;
  organizationId?: string | null;
  isPlatformAdmin: boolean;
  isApproved: boolean;
}) {
  await ensureAdminSchema();

  if (!isPlatformAdmin && requiresPlatformApproval() && !isApproved) {
    throw new Error("Your account is awaiting platform approval.");
  }

  if (isPlatformAdmin) return;

  const userControl = await getUserAccessControl(userId);
  if (userControl.is_hard_disabled) {
    throw new Error("Your account has been disabled by a platform administrator.");
  }

  if (userControl.is_suspended) {
    throw new Error(userControl.suspension_reason || "Your account is suspended.");
  }

  if (organizationId) {
    const banned = await isUserBannedFromOrganization(userId, organizationId);
    if (banned) {
      throw new Error("You no longer have access to the selected organization.");
    }
  }
}

export async function assertOrganizationWriteAllowed({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}) {
  await ensureAdminSchema();
  if (isPlatformAdmin) return;

  const control = await getOrganizationAccessControl(organizationId);
  if (control.is_locked) {
    throw new Error(control.lock_reason || "This organization is locked by platform admin.");
  }
}

export async function assertHostProxyAllowed({
  hostId,
  isPlatformAdmin,
}: {
  hostId: string;
  isPlatformAdmin: boolean;
}) {
  await ensureAdminSchema();
  if (isPlatformAdmin) return;

  const control = await getDockerHostAdminControl(hostId);
  if (control.is_quarantined) {
    throw new Error(control.quarantine_reason || "This host is quarantined by platform admin.");
  }
}

export async function assertAdvancedAlertsAccessAllowed({
  organizationId,
  isPlatformAdmin,
}: {
  organizationId: string;
  isPlatformAdmin: boolean;
}) {
  await assertOrganizationFeatureAllowed({
    organizationId,
    isPlatformAdmin,
    feature: "advanced_alerts",
  });
}
