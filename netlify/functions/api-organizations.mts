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
    const authContext = await requireAuth(req, { requireOrg: false });

    if (req.method === 'GET') {
      const orgs = await sql`
        SELECT o.* 
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ${authContext.userId}
        ORDER BY o.created_at ASC
      `;
      return new Response(JSON.stringify(orgs), { headers });
    }

    if (req.method === 'POST') {
      const { name } = await req.json();
      if (!name) return new Response(JSON.stringify({ error: 'Name required' }), { status: 400, headers });

      const [{ create_organization: orgId }] = await sql`
        SELECT public.create_organization(${name}, ${authContext.userId})
      `;

      return new Response(JSON.stringify({ id: orgId }), { headers });
    }

    if (req.method === 'PATCH') {
      if (!authContext.orgId) {
        return new Response(JSON.stringify({ error: 'Active org required' }), { status: 400, headers });
      }

      const body = await req.json();
      const onboardingStatus = body?.onboardingStatus;
      const allowedStatuses = ['not_started', 'skipped', 'completed'];

      if (!allowedStatuses.includes(onboardingStatus)) {
        return new Response(
          JSON.stringify({ error: 'Invalid onboardingStatus. Allowed values: not_started, skipped, completed' }),
          { status: 400, headers }
        );
      }

      const memberships = await sql`
        SELECT 1
        FROM organization_members
        WHERE organization_id = ${authContext.orgId} AND user_id = ${authContext.userId}
      `;

      if (memberships.length === 0) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers });
      }

      const updated = await sql`
        UPDATE organizations
        SET
          onboarding_status = ${onboardingStatus},
          onboarding_skipped_at = CASE
            WHEN ${onboardingStatus} = 'skipped' THEN COALESCE(onboarding_skipped_at, now())
            ELSE onboarding_skipped_at
          END,
          onboarding_completed_at = CASE
            WHEN ${onboardingStatus} = 'completed' THEN COALESCE(onboarding_completed_at, now())
            ELSE onboarding_completed_at
          END
        WHERE id = ${authContext.orgId}
        RETURNING id, clerk_org_id, onboarding_status, onboarding_skipped_at, onboarding_completed_at
      `;

      if (updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404, headers });
      }

      return new Response(JSON.stringify(updated[0]), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/organizations',
};
