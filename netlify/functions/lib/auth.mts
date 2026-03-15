import { createClerkClient } from '@clerk/backend';
import { sql } from './db.mjs';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  jwtKey: process.env.CLERK_JWT_KEY,
});

export interface AppAuthContext {
  userId: string; // The internal UUID
  orgId: string | null;  // The internal UUID, nullable if requireOrg is false
  clerkUserId: string;
  clerkOrgId: string | null;
}

export async function requireAuth(req: Request, options: { requireOrg?: boolean } = { requireOrg: true }): Promise<AppAuthContext> {
  if (process.env.NODE_ENV === 'test' && req.headers.get('x-test-bypass')) {
    return {
      userId: req.headers.get('x-test-user-id') || '00000000-0000-0000-0000-000000000000',
      orgId: req.headers.get('x-test-org-id') || '00000000-0000-0000-0000-000000000000',
      clerkUserId: 'clerk_test_user', // Provide dummy values for clerk IDs
      clerkOrgId: 'clerk_test_org',
    };
  }

  const requestState = await clerkClient.authenticateRequest(req, {
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtKey: process.env.CLERK_JWT_KEY,
  });

  if (!requestState.isSignedIn) {
    throw new Error('Unauthorized');
  }

  const authData = requestState.toAuth();
  if (!authData.userId) {
    throw new Error('Unauthorized: No user found');
  }
  
  // The frontend <OrganizationSwitcher/> injects the org_id into the session token automatically
  if (options.requireOrg && !authData.orgId) {
    throw new Error('No active organization selected. Please select an organization.');
  }

  const clerkUserId = authData.userId;
  const clerkOrgId = authData.orgId || null;

  const userResult = await sql`SELECT id FROM public.users WHERE clerk_user_id = ${clerkUserId}`;
  if (userResult.length === 0) {
    throw new Error('Sync pending. Your account is currently syncing.');
  }

  let orgId = null;
  if (clerkOrgId) {
    const orgResult = await sql`SELECT id FROM public.organizations WHERE clerk_org_id = ${clerkOrgId}`;
    if (orgResult.length === 0 && options.requireOrg) {
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
