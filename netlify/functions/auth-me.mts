import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { ensureOnboardingSchema } from './lib/ensure-onboarding-schema.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    await ensureOnboardingSchema();
    const authContext = await requireAuth(req, { requireOrg: false, requireApproved: false });

    const users = await sql`
      SELECT 
        u.id, u.email, u.full_name, u.avatar_url, u.is_approved
      FROM users u
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
        CASE WHEN ${authContext.orgId} IS NOT NULL AND o.id = ${authContext.orgId} THEN 0 ELSE 1 END,
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
      },
    }), { headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/auth/me',
};
