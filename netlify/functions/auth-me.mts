import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { ensureOnboardingSchema } from './lib/ensure-onboarding-schema.mjs';
import { ensureAdminSchema } from './lib/ensure-admin-schema.mjs';
import { isPlatformAdminEmail } from './lib/platform-admin.mjs';

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

    return new Response(JSON.stringify({
      user: {
        ...users[0],
        has_orgs: hasOrgs,
        needs_onboarding: needsOnboarding,
        onboarding_status: onboardingStatus,
        active_org_id: effectiveOrg?.id ?? null,
        active_org_clerk_id: effectiveOrg?.clerk_org_id ?? null,
        is_platform_admin: isPlatformAdminEmail(users[0].email),
        is_suspended: Boolean(users[0].is_suspended),
        is_hard_disabled: Boolean(users[0].is_hard_disabled),
      },
    }), { headers });

  } catch (err: any) {
    console.error('[auth-me] caught error:', err?.message);

    if (err?.code === 'SYNC_PENDING') {
      return new Response(JSON.stringify({ error: err.message, retry: true }), { status: 202, headers });
    }

    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/auth/me',
};
