import { sql } from './db.mjs';
import { clerkClient } from './clerk.mjs';

export interface AppAuthContext {
  userId: string; // The internal UUID
  orgId: string | null;  // The internal UUID, nullable if requireOrg is false
  clerkUserId: string;
  clerkOrgId: string | null;
}

interface AuthOptions {
  requireOrg?: boolean;
}

type AppAuthErrorCode = 'SYNC_PENDING';

interface AppAuthError extends Error {
  code?: AppAuthErrorCode;
}

function makeAppAuthError(message: string, code?: AppAuthErrorCode): AppAuthError {
  const err: AppAuthError = new Error(message);
  if (code) err.code = code;
  return err;
}

export async function requireAuth(
  req: Request,
  options: AuthOptions = { requireOrg: true }
): Promise<AppAuthContext> {
  const requireOrg = options.requireOrg ?? true;

  if (process.env.NODE_ENV === 'test' && req.headers.get('x-test-bypass')) {
    return {
      userId: req.headers.get('x-test-user-id') || '00000000-0000-0000-0000-000000000000',
      orgId: req.headers.get('x-test-org-id') || '00000000-0000-0000-0000-000000000000',
      clerkUserId: 'clerk_test_user',
      clerkOrgId: 'clerk_test_org',
    };
  }

  const requestState = await clerkClient.authenticateRequest(req, {
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
    jwtKey: process.env.CLERK_JWT_KEY,
    authorizedParties: ['https://app.dockerdash.app', 'http://localhost:5173', 'http://localhost:8888'],
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

  const userResult = await sql`SELECT id, is_approved FROM public.users WHERE clerk_user_id = ${clerkUserId}`;
  if (userResult.length === 0) {
    throw makeAppAuthError('Sync pending. Your account is currently syncing.', 'SYNC_PENDING');
  }

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

  return {
    userId: userResult[0].id,
    orgId,
    clerkUserId,
    clerkOrgId,
  };
}
