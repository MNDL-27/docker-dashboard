import { createClerkClient } from '@clerk/backend';
import { sql } from './db.mjs';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  jwtKey: process.env.CLERK_JWT_KEY,
});

export interface AppAuthContext {
  userId: string; // The internal UUID
  orgId: string;  // The internal UUID
  clerkUserId: string;
  clerkOrgId: string;
}

export async function requireAuth(req: Request): Promise<AppAuthContext> {
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
  if (!authData.orgId) {
    throw new Error('No active organization selected. Please select an organization.');
  }

  const clerkUserId = authData.userId;
  const clerkOrgId = authData.orgId;

  // Translate Clerk IDs to your internal Neon UUIDs
  const orgResult = await sql`SELECT id FROM public.organizations WHERE clerk_org_id = ${clerkOrgId}`;
  const userResult = await sql`SELECT id FROM public.users WHERE clerk_user_id = ${clerkUserId}`;

  if (orgResult.length === 0 || userResult.length === 0) {
    throw new Error('Sync pending. Your account or organization is currently syncing.');
  }

  return {
    userId: userResult[0].id,
    orgId: orgResult[0].id,
    clerkUserId,
    clerkOrgId,
  };
}
