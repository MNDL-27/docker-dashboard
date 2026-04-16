## Dockerdash Clerk Login Loop Debug

Date: 2026-04-17

### Symptom

- Browser shows repeated `GET /api/auth/me 401` on `https://app.dockerdash.app`
- App bounces between `/login` and `/app`
- Paddle/Profitwell console noise is unrelated

### Root Cause Pattern

The frontend trusts Clerk client state, but the backend independently validates the bearer token via `clerkClient.authenticateRequest()`.

The likely production failure point is the hardcoded `authorizedParties` allowlist in `netlify/functions/lib/auth.mts`. If the token `azp` claim is issued for a different first-party origin than `https://app.dockerdash.app`, backend auth rejects the request even while Clerk still reports `isSignedIn` in the browser.

### Loop Mechanism

1. `AppRootRedirect` sends client-signed-in users to `/app`.
2. `ProtectedRoute` calls `/api/auth/me`.
3. `auth-me` calls `requireAuth(req, { requireOrg: false })`.
4. `requireAuth()` returns unauthorized before DB checks if `authenticateRequest()` rejects the token.
5. `ProtectedRoute` treats `401` as unauthenticated and redirects to `/login`.
6. Clerk `SignIn` on `/login` uses `forceRedirectUrl="/app"`, so an already-signed-in browser session immediately re-enters `/app`.

### Smallest Safe Fix

Keep an explicit allowlist, but make Clerk authorized parties configurable by env instead of hardcoding them in source. Default to current local dev + production values, and add any canonical first-party origins used in Clerk session issuance.

Suggested env var:

- `CLERK_AUTHORIZED_PARTIES="https://app.dockerdash.app,https://dockerdash.app,https://www.dockerdash.app,http://localhost:5173,http://localhost:8888"`

### Follow-up Production Finding

- After the redirect loop was removed, `/api/auth/me` could still fail for signed-in users because access control still enforced manual approval for every non-admin user.
- `netlify/functions/lib/access-controls.mts` blocked users with `Your account is awaiting platform approval.` unless they were explicitly approved.
- That behavior conflicts with the current public-facing signup flow (`LandingPage` says `Now in Public Beta` and `SignupPage` drives straight into app onboarding).
- `netlify/functions/auth-me.mts` also flattened that access-control failure into a generic `401`, which made the browser console look like token/auth breakage even when the real issue was approval policy.

### Follow-up Fix

- Make platform approval opt-in via `REQUIRE_PLATFORM_APPROVALS` instead of always-on.
- Keep admin suspension/disable and org-ban checks intact.
- Map `auth-me` failures to more specific HTTP statuses so approval and org-selection issues do not all appear as generic unauthorized responses.

### Files

- `netlify/functions/lib/auth.mts`
- `netlify/functions/auth-me.mts`
- `src/components/ProtectedRoute.tsx`
- `src/components/AppRootRedirect.tsx`
- `src/pages/LoginPage.tsx`
- `netlify/functions/lib/access-controls.mts`
