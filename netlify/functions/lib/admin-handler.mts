import { clerkClient } from "./clerk.mjs";
import { sql } from "./db.mjs";
import { requirePlatformAdmin } from "./admin-auth.mjs";
import { assertAdminReason, normalizeAdminReason, recordAdminAudit } from "./admin-audit.mjs";
import { ensureAdminSchema } from "./ensure-admin-schema.mjs";
import { runSecretMigration } from "./secret-migration.mjs";
import { buildCorsHeaders } from "./security.mjs";

const headers = {
  "Access-Control-Allow-Origin": "*",  // Will be overridden by buildCorsHeaders in responses
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

async function readBody(req: Request) {
  return req.json().catch(() => ({}));
}

function parsePath(req: Request) {
  const url = new URL(req.url);
  return (url.pathname.replace(/^\/api\/admin/, "") || "/").split("/").filter(Boolean);
}

function toBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function toNullableTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function getOverview() {
  const [orgCount, userCount, activeHosts, suspendedUsers, lockedOrgs, quarantinedHosts] = await Promise.all([
    sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.organizations`,
    sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.users`,
    sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.docker_hosts WHERE status = 'connected'`,
    sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.user_access_controls WHERE is_suspended = true OR is_hard_disabled = true`,
    sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.organization_access_controls WHERE is_locked = true`,
    sql<{ count: string }[]>`SELECT count(*)::text AS count FROM public.docker_host_admin_controls WHERE is_quarantined = true`,
  ]);

  const recentOperations = await sql`
    SELECT
      id,
      operation_name,
      scope_type,
      scope_id,
      status,
      reason,
      result_summary,
      created_at
    FROM public.admin_operation_runs
    ORDER BY created_at DESC
    LIMIT 10
  `;

  return {
    metrics: {
      total_organizations: Number(orgCount[0]?.count || "0"),
      total_users: Number(userCount[0]?.count || "0"),
      active_hosts: Number(activeHosts[0]?.count || "0"),
      suspended_users: Number(suspendedUsers[0]?.count || "0"),
      locked_organizations: Number(lockedOrgs[0]?.count || "0"),
      quarantined_hosts: Number(quarantinedHosts[0]?.count || "0"),
    },
    recent_operations: recentOperations.map((row) => ({
      ...row,
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
  };
}

async function listUsers() {
  const rows = await sql`
    SELECT
      u.id,
      u.clerk_user_id,
      u.email,
      u.full_name,
      u.avatar_url,
      u.is_approved,
      u.created_at,
      COALESCE(uac.is_suspended, false) AS is_suspended,
      COALESCE(uac.is_hard_disabled, false) AS is_hard_disabled,
      uac.suspension_reason,
      COUNT(DISTINCT om.organization_id)::int AS organization_count
    FROM public.users u
    LEFT JOIN public.user_access_controls uac ON uac.user_id = u.id
    LEFT JOIN public.organization_members om ON om.user_id = u.id
    GROUP BY u.id, uac.user_id
    ORDER BY u.created_at DESC
  `;

  return rows.map((row) => ({
    ...row,
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

async function getUserDetail(userId: string) {
  const users = await sql`
    SELECT
      u.id,
      u.clerk_user_id,
      u.email,
      u.full_name,
      u.avatar_url,
      u.is_approved,
      u.created_at,
      COALESCE(uac.is_suspended, false) AS is_suspended,
      COALESCE(uac.is_hard_disabled, false) AS is_hard_disabled,
      uac.suspension_reason,
      uac.internal_notes
    FROM public.users u
    LEFT JOIN public.user_access_controls uac ON uac.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;

  if (users.length === 0) {
    return null;
  }

  const [memberships, bans] = await Promise.all([
    sql`
      SELECT
        o.id AS organization_id,
        o.name AS organization_name,
        om.role
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = ${userId}
      ORDER BY o.name ASC
    `,
    sql`
      SELECT
        b.organization_id,
        o.name AS organization_name,
        b.reason,
        b.created_at
      FROM public.organization_user_bans b
      JOIN public.organizations o ON o.id = b.organization_id
      WHERE b.user_id = ${userId}
      ORDER BY b.created_at DESC
    `,
  ]);

  return {
    ...users[0],
    created_at: new Date(String(users[0].created_at)).toISOString(),
    memberships,
    organization_bans: bans.map((row) => ({
      ...row,
      created_at: new Date(String(row.created_at)).toISOString(),
    })),
  };
}

async function listOrganizations() {
  const rows = await sql`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.plan,
      o.subscription_status,
      o.current_period_ends_at,
      o.cancel_at_period_end,
      o.paddle_subscription_id,
      o.paddle_customer_id,
      o.paddle_price_id,
      o.onboarding_status,
      COALESCE(oac.is_locked, false) AS is_locked,
      oac.lock_reason,
      oac.plan_override,
      oac.subscription_status_override,
      oac.current_period_ends_at_override,
      oac.cancel_at_period_end_override,
      COUNT(DISTINCT om.user_id)::int AS member_count,
      COUNT(DISTINCT h.id)::int AS host_count
    FROM public.organizations o
    LEFT JOIN public.organization_access_controls oac ON oac.organization_id = o.id
    LEFT JOIN public.organization_members om ON om.organization_id = o.id
    LEFT JOIN public.docker_hosts h ON h.organization_id = o.id
    GROUP BY o.id, oac.organization_id
    ORDER BY o.created_at DESC
  `;

  return rows.map((row) => ({
    ...row,
    current_period_ends_at: row.current_period_ends_at ? new Date(String(row.current_period_ends_at)).toISOString() : null,
    current_period_ends_at_override: row.current_period_ends_at_override ? new Date(String(row.current_period_ends_at_override)).toISOString() : null,
  }));
}

async function getOrganizationDetail(organizationId: string) {
  const organizations = await sql`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.plan,
      o.subscription_status,
      o.current_period_ends_at,
      o.cancel_at_period_end,
      o.paddle_subscription_id,
      o.paddle_customer_id,
      o.paddle_price_id,
      o.billing_updated_at,
      o.onboarding_status,
      o.onboarding_skipped_at,
      o.onboarding_completed_at,
      COALESCE(oac.is_locked, false) AS is_locked,
      oac.lock_reason,
      oac.plan_override,
      oac.subscription_status_override,
      oac.current_period_ends_at_override,
      oac.cancel_at_period_end_override
    FROM public.organizations o
    LEFT JOIN public.organization_access_controls oac ON oac.organization_id = o.id
    WHERE o.id = ${organizationId}
    LIMIT 1
  `;

  if (organizations.length === 0) {
    return null;
  }

  const [members, hosts, bans] = await Promise.all([
    sql`
      SELECT
        u.id AS user_id,
        u.email,
        u.full_name,
        om.role
      FROM public.organization_members om
      JOIN public.users u ON u.id = om.user_id
      WHERE om.organization_id = ${organizationId}
      ORDER BY lower(COALESCE(u.full_name, u.email)) ASC
    `,
    sql`
      SELECT
        h.id,
        h.name,
        h.status,
        COALESCE(hac.is_quarantined, false) AS is_quarantined,
        COALESCE(hac.needs_reconnect, false) AS needs_reconnect
      FROM public.docker_hosts h
      LEFT JOIN public.docker_host_admin_controls hac ON hac.host_id = h.id
      WHERE h.organization_id = ${organizationId}
      ORDER BY h.created_at DESC
    `,
    sql`
      SELECT
        b.user_id,
        u.email,
        u.full_name,
        b.reason,
        b.created_at
      FROM public.organization_user_bans b
      JOIN public.users u ON u.id = b.user_id
      WHERE b.organization_id = ${organizationId}
      ORDER BY b.created_at DESC
    `,
  ]);

  const row = organizations[0];
  return {
    ...row,
    current_period_ends_at: row.current_period_ends_at ? new Date(String(row.current_period_ends_at)).toISOString() : null,
    billing_updated_at: row.billing_updated_at ? new Date(String(row.billing_updated_at)).toISOString() : null,
    onboarding_skipped_at: row.onboarding_skipped_at ? new Date(String(row.onboarding_skipped_at)).toISOString() : null,
    onboarding_completed_at: row.onboarding_completed_at ? new Date(String(row.onboarding_completed_at)).toISOString() : null,
    current_period_ends_at_override: row.current_period_ends_at_override ? new Date(String(row.current_period_ends_at_override)).toISOString() : null,
    members,
    hosts,
    organization_bans: bans.map((item) => ({
      ...item,
      created_at: new Date(String(item.created_at)).toISOString(),
    })),
  };
}

async function listHosts() {
  const rows = await sql`
    SELECT
      h.id,
      h.organization_id,
      o.name AS organization_name,
      h.name,
      h.status,
      h.host_url,
      h.connection_mode,
      h.last_seen_at,
      COALESCE(hac.is_quarantined, false) AS is_quarantined,
      hac.quarantine_reason,
      COALESCE(hac.needs_reconnect, false) AS needs_reconnect
    FROM public.docker_hosts h
    JOIN public.organizations o ON o.id = h.organization_id
    LEFT JOIN public.docker_host_admin_controls hac ON hac.host_id = h.id
    ORDER BY h.created_at DESC
  `;

  return rows.map((row) => ({
    ...row,
    last_seen_at: row.last_seen_at ? new Date(String(row.last_seen_at)).toISOString() : null,
  }));
}

async function listAuditLog() {
  const rows = await sql`
    SELECT
      id,
      actor_user_id,
      actor_email,
      action,
      target_type,
      target_id,
      reason,
      before_state,
      after_state,
      request_metadata,
      created_at
    FROM public.admin_audit_log
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    ...row,
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

async function listOperationRuns() {
  const rows = await sql`
    SELECT
      id,
      actor_user_id,
      operation_name,
      scope_type,
      scope_id,
      status,
      reason,
      metadata,
      result_summary,
      created_at
    FROM public.admin_operation_runs
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return rows.map((row) => ({
    ...row,
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

async function mutateUserApproval(userId: string, approved: boolean, req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const before = await sql`
    SELECT id, is_approved
    FROM public.users
    WHERE id = ${userId}
    LIMIT 1
  `;
  if (before.length === 0) return json({ error: "User not found" }, 404);

  const updated = await sql`
    UPDATE public.users
    SET is_approved = ${approved}
    WHERE id = ${userId}
    RETURNING id, is_approved
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: approved ? "approve-user" : "revoke-user-approval",
    targetType: "user",
    targetId: userId,
    reason,
    beforeState: before[0] as Record<string, unknown>,
    afterState: updated[0] as Record<string, unknown>,
    requestMetadata: { ip: req.headers.get("x-forwarded-for") || null },
  });

  return json({ user: updated[0] });
}

async function mutateUserAccess(userId: string, mode: "suspend" | "unsuspend" | "hard-disable" | "hard-enable", req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  const notes = typeof body.internal_notes === "string" ? body.internal_notes.trim() : null;
  assertAdminReason(reason);

  const users = await sql`
    SELECT u.id, u.clerk_user_id, u.email, COALESCE(uac.is_suspended, false) AS is_suspended, COALESCE(uac.is_hard_disabled, false) AS is_hard_disabled
    FROM public.users u
    LEFT JOIN public.user_access_controls uac ON uac.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  if (users.length === 0) return json({ error: "User not found" }, 404);

  const before = users[0] as Record<string, unknown>;
  const user = users[0];
  const isSuspended = mode === "suspend" ? true : mode === "unsuspend" ? false : Boolean(user.is_suspended);
  const isHardDisabled = mode === "hard-disable" ? true : mode === "hard-enable" ? false : Boolean(user.is_hard_disabled);
  const suspensionReason = mode === "suspend" || mode === "hard-disable" ? reason : null;

  if (user.clerk_user_id) {
    if (mode === "hard-disable") {
      await clerkClient.users.banUser(String(user.clerk_user_id));
      await clerkClient.users.lockUser(String(user.clerk_user_id));
    } else if (mode === "hard-enable") {
      await clerkClient.users.unbanUser(String(user.clerk_user_id));
      await clerkClient.users.unlockUser(String(user.clerk_user_id));
    }
  }

  const afterRows = await sql`
    INSERT INTO public.user_access_controls (
      user_id,
      is_suspended,
      is_hard_disabled,
      suspension_reason,
      internal_notes,
      updated_by
    )
    VALUES (
      ${userId},
      ${isSuspended},
      ${isHardDisabled},
      ${suspensionReason},
      ${notes},
      ${admin.auth.userId}
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      is_suspended = EXCLUDED.is_suspended,
      is_hard_disabled = EXCLUDED.is_hard_disabled,
      suspension_reason = EXCLUDED.suspension_reason,
      internal_notes = COALESCE(EXCLUDED.internal_notes, public.user_access_controls.internal_notes),
      updated_by = EXCLUDED.updated_by
    RETURNING user_id, is_suspended, is_hard_disabled, suspension_reason, internal_notes
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: mode,
    targetType: "user",
    targetId: userId,
    reason,
    beforeState: before,
    afterState: afterRows[0] as Record<string, unknown>,
  });

  return json({ control: afterRows[0] });
}

async function addOrganizationBan(userId: string, req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  if (!organizationId) return json({ error: "organization_id is required" }, 400);

  const before = await sql`
    SELECT organization_id, user_id, reason
    FROM public.organization_user_bans
    WHERE organization_id = ${organizationId} AND user_id = ${userId}
  `;

  const afterRows = await sql`
    INSERT INTO public.organization_user_bans (organization_id, user_id, reason, created_by)
    VALUES (${organizationId}, ${userId}, ${reason}, ${admin.auth.userId})
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET reason = EXCLUDED.reason, created_by = EXCLUDED.created_by, created_at = now()
    RETURNING organization_id, user_id, reason, created_at
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: "add-org-ban",
    targetType: "organization-user-ban",
    targetId: `${organizationId}:${userId}`,
    reason,
    beforeState: before[0] as Record<string, unknown> | undefined,
    afterState: afterRows[0] as Record<string, unknown>,
  });

  return json({ ban: afterRows[0] }, 201);
}

async function removeOrganizationBan(userId: string, organizationId: string, req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const before = await sql`
    SELECT organization_id, user_id, reason
    FROM public.organization_user_bans
    WHERE organization_id = ${organizationId} AND user_id = ${userId}
  `;
  if (before.length === 0) return json({ error: "Ban not found" }, 404);

  await sql`
    DELETE FROM public.organization_user_bans
    WHERE organization_id = ${organizationId} AND user_id = ${userId}
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: "remove-org-ban",
    targetType: "organization-user-ban",
    targetId: `${organizationId}:${userId}`,
    reason,
    beforeState: before[0] as Record<string, unknown>,
    afterState: {},
  });

  return json({ success: true });
}

async function mutateOrganizationLock(organizationId: string, locked: boolean, req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const before = await sql`
    SELECT
      organization_id,
      COALESCE(is_locked, false) AS is_locked,
      lock_reason
    FROM public.organization_access_controls
    WHERE organization_id = ${organizationId}
  `;

  const afterRows = await sql`
    INSERT INTO public.organization_access_controls (
      organization_id,
      is_locked,
      lock_reason,
      updated_by
    )
    VALUES (
      ${organizationId},
      ${locked},
      ${locked ? reason : null},
      ${admin.auth.userId}
    )
    ON CONFLICT (organization_id) DO UPDATE
    SET
      is_locked = EXCLUDED.is_locked,
      lock_reason = EXCLUDED.lock_reason,
      updated_by = EXCLUDED.updated_by
    RETURNING organization_id, is_locked, lock_reason
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: locked ? "lock-organization" : "unlock-organization",
    targetType: "organization",
    targetId: organizationId,
    reason,
    beforeState: before[0] as Record<string, unknown> | undefined,
    afterState: afterRows[0] as Record<string, unknown>,
  });

  return json({ organization_control: afterRows[0] });
}

async function updateOrganizationBilling(organizationId: string, req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const plan = typeof body.plan === "string" ? body.plan : null;
  const subscriptionStatus = typeof body.subscription_status === "string" ? body.subscription_status : null;
  const currentPeriodEndsAt = toNullableTimestamp(body.current_period_ends_at);
  const cancelAtPeriodEnd = typeof body.cancel_at_period_end === "boolean" ? body.cancel_at_period_end : null;

  const before = await sql`
    SELECT
      o.id,
      o.plan,
      o.subscription_status,
      o.current_period_ends_at,
      o.cancel_at_period_end,
      o.paddle_subscription_id,
      o.paddle_customer_id,
      o.paddle_price_id,
      oac.plan_override,
      oac.subscription_status_override,
      oac.current_period_ends_at_override,
      oac.cancel_at_period_end_override
    FROM public.organizations o
    LEFT JOIN public.organization_access_controls oac ON oac.organization_id = o.id
    WHERE o.id = ${organizationId}
    LIMIT 1
  `;
  if (before.length === 0) return json({ error: "Organization not found" }, 404);

  const [organization] = await sql`
    UPDATE public.organizations
    SET
      plan = COALESCE(${plan}, plan),
      subscription_status = COALESCE(${subscriptionStatus}, subscription_status),
      current_period_ends_at = COALESCE(${currentPeriodEndsAt}, current_period_ends_at),
      cancel_at_period_end = COALESCE(${cancelAtPeriodEnd}, cancel_at_period_end),
      billing_updated_at = now()
    WHERE id = ${organizationId}
    RETURNING id, plan, subscription_status, current_period_ends_at, cancel_at_period_end
  `;

  const [overrides] = await sql`
    INSERT INTO public.organization_access_controls (
      organization_id,
      plan_override,
      subscription_status_override,
      current_period_ends_at_override,
      cancel_at_period_end_override,
      updated_by
    )
    VALUES (
      ${organizationId},
      ${plan},
      ${subscriptionStatus},
      ${currentPeriodEndsAt},
      ${cancelAtPeriodEnd},
      ${admin.auth.userId}
    )
    ON CONFLICT (organization_id) DO UPDATE
    SET
      plan_override = COALESCE(EXCLUDED.plan_override, public.organization_access_controls.plan_override),
      subscription_status_override = COALESCE(EXCLUDED.subscription_status_override, public.organization_access_controls.subscription_status_override),
      current_period_ends_at_override = COALESCE(EXCLUDED.current_period_ends_at_override, public.organization_access_controls.current_period_ends_at_override),
      cancel_at_period_end_override = COALESCE(EXCLUDED.cancel_at_period_end_override, public.organization_access_controls.cancel_at_period_end_override),
      updated_by = EXCLUDED.updated_by
    RETURNING organization_id, plan_override, subscription_status_override, current_period_ends_at_override, cancel_at_period_end_override
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: "edit-billing",
    targetType: "organization",
    targetId: organizationId,
    reason,
    beforeState: before[0] as Record<string, unknown>,
    afterState: { organization, overrides },
  });

  return json({ organization, overrides });
}

async function resetOrganizationOnboarding(organizationId: string, req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const before = await sql`
    SELECT id, onboarding_status, onboarding_skipped_at, onboarding_completed_at
    FROM public.organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `;
  if (before.length === 0) return json({ error: "Organization not found" }, 404);

  const afterRows = await sql`
    UPDATE public.organizations
    SET
      onboarding_status = 'not_started',
      onboarding_skipped_at = NULL,
      onboarding_completed_at = NULL
    WHERE id = ${organizationId}
    RETURNING id, onboarding_status, onboarding_skipped_at, onboarding_completed_at
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: "reset-onboarding",
    targetType: "organization",
    targetId: organizationId,
    reason,
    beforeState: before[0] as Record<string, unknown>,
    afterState: afterRows[0] as Record<string, unknown>,
  });

  return json({ organization: afterRows[0] });
}

async function mutateHostControl(hostId: string, mode: "quarantine" | "unquarantine" | "mark-needs-reconnect", req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const before = await sql`
    SELECT
      host_id,
      COALESCE(is_quarantined, false) AS is_quarantined,
      quarantine_reason,
      COALESCE(needs_reconnect, false) AS needs_reconnect
    FROM public.docker_host_admin_controls
    WHERE host_id = ${hostId}
  `;

  const afterRows = await sql`
    INSERT INTO public.docker_host_admin_controls (
      host_id,
      is_quarantined,
      quarantine_reason,
      needs_reconnect,
      updated_by
    )
    VALUES (
      ${hostId},
      ${mode === "quarantine"},
      ${mode === "quarantine" ? reason : null},
      ${mode === "mark-needs-reconnect"},
      ${admin.auth.userId}
    )
    ON CONFLICT (host_id) DO UPDATE
    SET
      is_quarantined = CASE
        WHEN ${mode} = 'quarantine' THEN true
        WHEN ${mode} = 'unquarantine' THEN false
        ELSE public.docker_host_admin_controls.is_quarantined
      END,
      quarantine_reason = CASE
        WHEN ${mode} = 'quarantine' THEN ${reason}
        WHEN ${mode} = 'unquarantine' THEN NULL
        ELSE public.docker_host_admin_controls.quarantine_reason
      END,
      needs_reconnect = CASE
        WHEN ${mode} = 'mark-needs-reconnect' THEN true
        ELSE public.docker_host_admin_controls.needs_reconnect
      END,
      updated_by = EXCLUDED.updated_by
    RETURNING host_id, is_quarantined, quarantine_reason, needs_reconnect
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: mode,
    targetType: "docker-host",
    targetId: hostId,
    reason,
    beforeState: before[0] as Record<string, unknown> | undefined,
    afterState: afterRows[0] as Record<string, unknown>,
  });

  return json({ host_control: afterRows[0] });
}

async function runAdminSecretMigration(req: Request) {
  const admin = await requirePlatformAdmin(req);
  const body = await readBody(req);
  const reason = normalizeAdminReason(body.reason);
  assertAdminReason(reason);

  const scope = {
    organizationId: typeof body.organization_id === "string" ? body.organization_id : null,
    hostId: typeof body.host_id === "string" ? body.host_id : null,
    dryRun: toBoolean(body.dry_run),
  };

  const result = await runSecretMigration(scope);
  const [operation] = await sql`
    INSERT INTO public.admin_operation_runs (
      actor_user_id,
      operation_name,
      scope_type,
      scope_id,
      status,
      reason,
      metadata,
      result_summary
    )
    VALUES (
      ${admin.auth.userId},
      'migrate-secrets',
      ${scope.hostId ? "host" : scope.organizationId ? "organization" : "global"},
      ${scope.hostId ?? scope.organizationId ?? null},
      ${result.failedCount > 0 ? "completed-with-errors" : "completed"},
      ${reason},
      ${JSON.stringify(scope)}::jsonb,
      ${JSON.stringify(result)}::jsonb
    )
    RETURNING id, operation_name, scope_type, scope_id, status, reason, metadata, result_summary, created_at
  `;

  await recordAdminAudit({
    actorUserId: admin.auth.userId,
    actorEmail: admin.actorEmail,
    action: "migrate-secrets",
    targetType: "operation",
    targetId: String(operation.id),
    reason,
    beforeState: {},
    afterState: { result, operationId: operation.id },
  });

  return json({ success: true, result, operation: { ...operation, created_at: new Date(String(operation.created_at)).toISOString() } });
}

export async function handleAdminRequest(req: Request) {
  // Build secure CORS headers based on request origin
  const corsHeaders = buildCorsHeaders(req);
  
  // Override the json helper to use CORS headers
  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: corsHeaders });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await ensureAdminSchema();
    const parts = parsePath(req);

    if (req.method === "GET" && parts.length === 0) {
      return json(await getOverview());
    }

    if (req.method === "GET" && parts.length === 1 && parts[0] === "overview") {
      return json(await getOverview());
    }

    if (req.method === "GET" && parts.length === 1 && parts[0] === "users") {
      await requirePlatformAdmin(req);
      return json({ users: await listUsers() });
    }

    if (req.method === "GET" && parts.length === 2 && parts[0] === "users") {
      await requirePlatformAdmin(req);
      const user = await getUserDetail(parts[1]);
      return user ? json({ user }) : json({ error: "User not found" }, 404);
    }

    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "approve") return await mutateUserApproval(parts[1], true, req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "revoke-approval") return await mutateUserApproval(parts[1], false, req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "suspend") return await mutateUserAccess(parts[1], "suspend", req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "unsuspend") return await mutateUserAccess(parts[1], "unsuspend", req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "hard-disable") return await mutateUserAccess(parts[1], "hard-disable", req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "hard-enable") return await mutateUserAccess(parts[1], "hard-enable", req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "users" && parts[2] === "org-bans") return await addOrganizationBan(parts[1], req);
    if (req.method === "DELETE" && parts.length === 4 && parts[0] === "users" && parts[2] === "org-bans") return await removeOrganizationBan(parts[1], parts[3], req);

    if (req.method === "GET" && parts.length === 1 && parts[0] === "organizations") {
      await requirePlatformAdmin(req);
      return json({ organizations: await listOrganizations() });
    }

    if (req.method === "GET" && parts.length === 2 && parts[0] === "organizations") {
      await requirePlatformAdmin(req);
      const organization = await getOrganizationDetail(parts[1]);
      return organization ? json({ organization }) : json({ error: "Organization not found" }, 404);
    }

    if (req.method === "POST" && parts.length === 3 && parts[0] === "organizations" && parts[2] === "lock") return await mutateOrganizationLock(parts[1], true, req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "organizations" && parts[2] === "unlock") return await mutateOrganizationLock(parts[1], false, req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "organizations" && parts[2] === "billing") return await updateOrganizationBilling(parts[1], req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "organizations" && parts[2] === "reset-onboarding") return await resetOrganizationOnboarding(parts[1], req);

    if (req.method === "GET" && parts.length === 1 && parts[0] === "hosts") {
      await requirePlatformAdmin(req);
      return json({ hosts: await listHosts() });
    }

    if (req.method === "POST" && parts.length === 3 && parts[0] === "hosts" && parts[2] === "quarantine") return await mutateHostControl(parts[1], "quarantine", req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "hosts" && parts[2] === "unquarantine") return await mutateHostControl(parts[1], "unquarantine", req);
    if (req.method === "POST" && parts.length === 3 && parts[0] === "hosts" && parts[2] === "mark-needs-reconnect") return await mutateHostControl(parts[1], "mark-needs-reconnect", req);

    if (req.method === "GET" && parts.length === 1 && parts[0] === "audit-log") {
      await requirePlatformAdmin(req);
      return json({ audit_log: await listAuditLog() });
    }

    if (req.method === "GET" && parts.length === 1 && parts[0] === "operations") {
      await requirePlatformAdmin(req);
      return json({ operations: await listOperationRuns() });
    }

    if (req.method === "POST" && parts.length === 1 && parts[0] === "migrate-secrets") return await runAdminSecretMigration(req);

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const lower = message.toLowerCase();
    const status = lower.includes("forbidden") ? 403 : lower.includes("unauthorized") ? 401 : 400;
    return json({ error: message }, status);
  }
}
