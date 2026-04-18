import { sql } from "./db.mjs";
import { ensureAdminSchema } from "./ensure-admin-schema.mjs";
import { isDonorPremiumActive } from "./donor-billing.mjs";

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
  await ensureAdminSchema();
  if (isPlatformAdmin) return;

  const control = await getOrganizationAccessControl(organizationId);
  const isPremium =
    control.plan_override === "pro" ||
    control.plan_override === "team" ||
    control.plan_override === "enterprise";

  if (isPremium) return;

  const { active: isDonorPremium } = await isDonorPremiumActive(organizationId);
  if (isDonorPremium) return;

  throw new Error("Advanced Alert Rules require a Premium or Team subscription.");
}
