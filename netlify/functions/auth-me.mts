import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { ensureOnboardingSchema } from './lib/ensure-onboarding-schema.mjs';
import { ensureAdminSchema } from './lib/ensure-admin-schema.mjs';
import { isPlatformAdminEmail } from './lib/platform-admin.mjs';
import { ensureDedicatedDeploymentSchema } from './lib/ensure-dedicated-deployment-schema.mjs';
import { resolveOrganizationEntitlements } from './lib/access-controls.mjs';
import { getOrganizationScanQuotaSummary } from './lib/scan-usage.mjs';

const allowedOrigins = new Set([
  'https://app.dockerdash.app',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8888',
]);

function buildHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.has(origin) ? origin : 'https://app.dockerdash.app';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

export default async (req: Request) => {
  const headers = buildHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    await ensureOnboardingSchema();
    await ensureAdminSchema();
    await ensureDedicatedDeploymentSchema();
    const authContext = await requireAuth(req, { requireOrg: false });

    const users = await sql`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.avatar_url,
        u.is_approved,
        COALESCE(uac.is_suspended, false) AS is_suspended,
        COALESCE(uac.is_hard_disabled, false) AS is_hard_disabled
      FROM users u
      LEFT JOIN user_access_controls uac ON uac.user_id = u.id
      WHERE u.id = ${authContext.userId}
    `;

    if (users.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
    }

    const orgMemberships = await sql`
      SELECT
        o.id,
        o.clerk_org_id,
        o.onboarding_status,
        o.plan,
        om.created_at
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = ${authContext.userId}
      ORDER BY
        CASE WHEN ${authContext.orgId}::uuid IS NOT NULL AND o.id = ${authContext.orgId}::uuid THEN 0 ELSE 1 END,
        om.created_at ASC
    `;

    const hasOrgs = orgMemberships.length > 0;
    const activeOrg = orgMemberships.find((org) => org.id === authContext.orgId) ?? null;
    const effectiveOrg = activeOrg ?? orgMemberships[0] ?? null;
    const onboardingStatus = (effectiveOrg?.onboarding_status as string | undefined) ?? null;
    const needsOnboarding = !effectiveOrg || onboardingStatus === 'not_started';
    const isPlatformAdmin = isPlatformAdminEmail(users[0].email);
    const dedicatedDeployment =
      effectiveOrg
        ? await sql`
            SELECT status, updated_at
            FROM public.dedicated_deployments
            WHERE organization_id = ${effectiveOrg.id}
            LIMIT 1
          `
        : [];
    const entitlements = effectiveOrg
      ? await resolveOrganizationEntitlements({
          organizationId: effectiveOrg.id,
          isPlatformAdmin,
        })
      : null;
    const scanQuota = effectiveOrg
      ? await getOrganizationScanQuotaSummary({
          organizationId: effectiveOrg.id,
          isPlatformAdmin,
        })
      : null;
    const effectivePlan =
      scanQuota?.effectivePlan ??
      (scanQuota?.monthlyScanLimit === null ? effectiveOrg?.plan ?? null : 'free');

    return new Response(JSON.stringify({
      user: {
        ...users[0],
        has_orgs: hasOrgs,
        needs_onboarding: needsOnboarding,
        onboarding_status: onboardingStatus,
        active_org_id: effectiveOrg?.id ?? null,
        active_org_clerk_id: effectiveOrg?.clerk_org_id ?? null,
        active_org_plan: effectiveOrg?.plan ?? null,
        active_org_effective_plan: effectivePlan,
        active_org_scan_limit: scanQuota?.monthlyScanLimit ?? null,
        active_org_scan_used: scanQuota?.scansUsed ?? 0,
        active_org_scan_remaining: scanQuota?.scansRemaining ?? null,
        active_org_scan_reset_at: scanQuota?.resetAt ?? null,
        dedicated_deployment_status: dedicatedDeployment[0]?.status ?? null,
        dedicated_deployment_updated_at: dedicatedDeployment[0]?.updated_at ? new Date(String(dedicatedDeployment[0].updated_at)).toISOString() : null,
        is_platform_admin: isPlatformAdmin,
        is_suspended: Boolean(users[0].is_suspended),
        is_hard_disabled: Boolean(users[0].is_hard_disabled),
        entitlements,
        scan_quota: scanQuota
          ? {
              monthBucket: scanQuota.monthBucket,
              monthlyScanLimit: scanQuota.monthlyScanLimit,
              scansUsed: scanQuota.scansUsed,
              scansRemaining: scanQuota.scansRemaining,
              scansExceeded: scanQuota.scansExceeded,
              resetAt: scanQuota.resetAt,
              effectivePlan: scanQuota.effectivePlan,
            }
          : null,
      },
    }), { headers });

  } catch (err: any) {
    console.error('[auth-me] caught error:', err?.message);

    if (err?.code === 'SYNC_PENDING') {
      return new Response(JSON.stringify({ error: err.message, code: err.code, retry: true }), { status: 202, headers });
    }

    const message = err?.message || 'Unauthorized';
    const lowerMessage = String(message).toLowerCase();
    const status =
      lowerMessage.includes('awaiting platform approval') ||
      lowerMessage.includes('disabled by a platform administrator') ||
      lowerMessage.includes('account is suspended') ||
      lowerMessage.includes('no longer have access to the selected organization')
        ? 403
        : lowerMessage.includes('no active organization selected')
          ? 409
          : 401;

    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
};

export const config: Config = {
  path: '/api/auth/me',
};
