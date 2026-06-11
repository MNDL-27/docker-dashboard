import { sql } from './db.mjs';
import { clerkClient, getClerkConfig } from './clerk.mjs';
import { assertTenantAccessAllowed } from './access-controls.mjs';
import { ensureAdminSchema } from './ensure-admin-schema.mjs';
import { isPlatformAdminEmail } from './platform-admin.mjs';

export interface AppAuthContext {
  userId: string; // The internal UUID
  orgId: string | null;  // The internal UUID, nullable if requireOrg is false
  clerkUserId: string;
  clerkOrgId: string | null;
  isPlatformAdmin: boolean;
  email: string;
}

export interface ClerkAuthResult {
  authenticated: boolean;
  userId: string;
}

export async function buildClerkAuthFromRequest(req: Request): Promise<ClerkAuthResult> {
  const requestState = await clerkClient.authenticateRequest(req, {
    ...getClerkConfig(),
    authorizedParties: getAuthorizedParties(req),
  });

  if (!requestState.isSignedIn) {
    return { authenticated: false, userId: '' };
  }

  const authData = requestState.toAuth();
  if (!authData.userId) {
    return { authenticated: false, userId: '' };
  }

  const userResult = await sql`SELECT id FROM public.users WHERE clerk_user_id = ${authData.userId}`;
  if (userResult.length === 0) {
    return { authenticated: false, userId: '' };
  }

  return {
    authenticated: true,
    userId: userResult[0].id,
  };
}

export async function requireAuth(
  req: Request,
  options: AuthOptions = { requireOrg: true }
): Promise<AppAuthContext> {
  const requireOrg = options.requireOrg ?? true;

  // Test bypass has been removed from production code.
  // For testing, use mock implementations in test files only.
  // See: /workspace/netlify/functions/lib/auth.test.mts for test mocks

  const requestState = await clerkClient.authenticateRequest(req, {
    ...getClerkConfig(),
    authorizedParties: getAuthorizedParties(req),
  });

  if (!requestState.isSignedIn) {
    const reason = requestState.reason || 'unknown';
    const message = requestState.message || 'none';
    const hasAuthHeader = req.headers.get('authorization') ? 'yes' : 'no';
    console.error(`[requireAuth] 401 | reason=${reason} | message=${message} | has-auth-header=${hasAuthHeader}`);

    const reasonLower = reason.toLowerCase();
    const messageLower = message.toLowerCase();
    if (reasonLower === 'session-token-outdated' || messageLower.includes('sync')) {
      throw makeAppAuthError('Sync pending. Your account is currently syncing.', 'SYNC_PENDING');
    }

    throw new Error(`Unauthorized. Reason: ${reason}, Message: ${message}`);
  }

  const authData = requestState.toAuth();
  if (!authData.userId) {
    throw new Error('Unauthorized: No user found');
  }
  
  // The frontend <OrganizationSwitcher/> injects the org_id into the session token automatically
  if (requireOrg && !authData.orgId) {
    throw new Error('No active organization selected. Please select an organization.');
  }

  const clerkUserId = authData.userId;
  const clerkOrgId = authData.orgId || null;

  await ensureAdminSchema();
  const userResult = await sql`SELECT id, email, is_approved FROM public.users WHERE clerk_user_id = ${clerkUserId}`;
  if (userResult.length === 0) {
    throw makeAppAuthError('Sync pending. Your account is currently syncing.', 'SYNC_PENDING');
  }

  const isPlatformAdmin = isPlatformAdminEmail(userResult[0].email);

  let orgId = null;
  if (clerkOrgId) {
    const orgResult = await sql`SELECT id FROM public.organizations WHERE clerk_org_id = ${clerkOrgId}`;
    if (orgResult.length === 0 && requireOrg) {
      throw new Error('Sync pending. Your organization is currently syncing.');
    }
    if (orgResult.length > 0) {
      orgId = orgResult[0].id;
    }
  }

  await assertTenantAccessAllowed({
    userId: userResult[0].id,
    organizationId: orgId,
    isPlatformAdmin,
    isApproved: Boolean(userResult[0].is_approved),
  });

  return {
    userId: userResult[0].id,
    orgId,
    clerkUserId,
    clerkOrgId,
    isPlatformAdmin,
    email: userResult[0].email,
  };
}
