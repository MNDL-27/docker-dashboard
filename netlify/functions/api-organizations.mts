import type { Config } from '@netlify/functions';
import { sql } from './lib/db.mjs';
import { requireAuth } from './lib/auth.mjs';
import { assertOrganizationWriteAllowed, assertUserOrganizationCapacityAvailable } from './lib/access-controls.mjs';

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

      // Enforce org limit based on user's effective plan
      await assertUserOrganizationCapacityAvailable({
        userId: authContext.userId,
        isPlatformAdmin: authContext.isPlatformAdmin,
      });

      const [{ create_organization: orgId }] = await sql`
        SELECT public.create_organization(${name}, ${authContext.userId})
      `;

      return new Response(JSON.stringify({ id: orgId }), { headers });
    }

    if (req.method === 'PATCH') {
      const body = await req.json();
      const onboardingStatus = body?.onboardingStatus;
      const requestedClerkOrgId = typeof body?.clerkOrgId === 'string' ? body.clerkOrgId : null;
      const allowedStatuses = ['not_started', 'skipped', 'completed'];

      if (!allowedStatuses.includes(onboardingStatus)) {
        return new Response(
          JSON.stringify({ error: 'Invalid onboardingStatus. Allowed values: not_started, skipped, completed' }),
          { status: 400, headers }
        );
      }

      let targetOrgId = authContext.orgId;
      const activeClerkOrgId = authContext.clerkOrgId ?? null;
      const membershipRows = await sql`
        SELECT o.id
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ${authContext.userId}
        ORDER BY om.created_at ASC
      `;

      if (requestedClerkOrgId) {
        const requestedOrgRows = await sql`
          SELECT o.id
          FROM organizations o
          JOIN organization_members om ON o.id = om.organization_id
          WHERE om.user_id = ${authContext.userId} AND o.clerk_org_id = ${requestedClerkOrgId}
          LIMIT 1
        `;

        if (requestedOrgRows.length === 0) {
          const canCreatePendingOrg =
            activeClerkOrgId === requestedClerkOrgId ||
            (!activeClerkOrgId && membershipRows.length === 0);

          if (canCreatePendingOrg) {
            const pendingSlugBase = requestedClerkOrgId
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 40) || 'pending-org';
            const pendingSlug = `${pendingSlugBase}-${Date.now().toString(36)}`;

            const [createdOrg] = await sql`
              INSERT INTO public.organizations (name, slug, clerk_org_id, created_by)
              VALUES ('Pending organization', ${pendingSlug}, ${requestedClerkOrgId}, ${authContext.userId})
              ON CONFLICT (clerk_org_id) DO UPDATE
              SET updated_at = now()
              RETURNING id
            `;

            await sql`
              INSERT INTO public.organization_members (organization_id, user_id, role)
              VALUES (${createdOrg.id}, ${authContext.userId}, 'owner')
              ON CONFLICT (organization_id, user_id) DO NOTHING
            `;

            targetOrgId = createdOrg.id;
          } else if (activeClerkOrgId === requestedClerkOrgId) {
            return new Response(
              JSON.stringify({ error: 'Organization sync pending. Please retry.', retry: true }),
              { status: 202, headers }
            );
          }

          return new Response(JSON.stringify({ error: 'Requested organization not found for current user' }), { status: 404, headers });
        }

        targetOrgId = requestedOrgRows[0].id;
      }

      if (!targetOrgId) {
        if (membershipRows.length === 0) {
          return new Response(JSON.stringify({ error: 'No organization membership found' }), { status: 400, headers });
        }

        if (membershipRows.length > 1) {
          return new Response(
            JSON.stringify({ error: 'Multiple organizations found. Please select an active organization and retry.' }),
            { status: 400, headers }
          );
        }

        targetOrgId = membershipRows[0].id;
      }

      const memberships = await sql`
        SELECT 1
        FROM organization_members
        WHERE organization_id = ${targetOrgId} AND user_id = ${authContext.userId}
      `;

      if (memberships.length === 0) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers });
      }

      await assertOrganizationWriteAllowed({
        organizationId: targetOrgId,
        isPlatformAdmin: authContext.isPlatformAdmin,
      });

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
        WHERE id = ${targetOrgId}
        RETURNING id, clerk_org_id, onboarding_status, onboarding_skipped_at, onboarding_completed_at
      `;

      if (updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404, headers });
      }

      return new Response(JSON.stringify(updated[0]), { headers });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const rawOrgId = url.searchParams.get('orgId');
      if (!rawOrgId) {
        return new Response(JSON.stringify({ error: 'orgId query parameter required' }), { status: 400, headers });
      }

      // Resolve Clerk org ID to internal UUID if needed
      let deleteOrgId = rawOrgId;
      if (rawOrgId.startsWith('org_')) {
        const orgLookup = await sql`
          SELECT id FROM public.organizations WHERE clerk_org_id = ${rawOrgId} LIMIT 1
        `;
        if (orgLookup.length === 0) {
          return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404, headers });
        }
        deleteOrgId = orgLookup[0].id;
      }

      // Verify user is the owner of this org
      const ownerCheck = await sql`
        SELECT om.role
        FROM organization_members om
        WHERE om.organization_id = ${deleteOrgId}
          AND om.user_id = ${authContext.userId}
      `;

      if (ownerCheck.length === 0) {
        return new Response(JSON.stringify({ error: 'Organization not found or you are not a member' }), { status: 404, headers });
      }

      if (ownerCheck[0].role !== 'owner' && !authContext.isPlatformAdmin) {
        return new Response(JSON.stringify({ error: 'Only the organization owner can delete it' }), { status: 403, headers });
      }

      // Refuse deletion if org still has hosts
      const [{ count: hostCount }] = await sql<Array<{ count: string }>>`
        SELECT COUNT(*)::text AS count
        FROM public.docker_hosts
        WHERE organization_id = ${deleteOrgId}
      `;

      if (Number.parseInt(hostCount ?? '0', 10) > 0) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete an organization that still has connected hosts. Remove all hosts first.' }),
          { status: 409, headers }
        );
      }

      // Delete org (cascades to members, alerts, etc. via FK)
      const deleted = await sql`
        DELETE FROM public.organizations
        WHERE id = ${deleteOrgId}
        RETURNING id, clerk_org_id
      `;

      if (deleted.length === 0) {
        return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404, headers });
      }

      return new Response(JSON.stringify({ success: true, id: deleted[0].id }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (err: any) {
    console.error('[api-organizations] caught error:', err?.message);

    if (err?.code === 'SYNC_PENDING') {
      return new Response(JSON.stringify({ error: err.message, retry: true }), {
        status: 202,
        headers,
      });
    }

    return new Response(JSON.stringify({ error: err.message || 'Unauthorized' }), { status: 401, headers });
  }
};

export const config: Config = {
  path: '/api/organizations',
};
