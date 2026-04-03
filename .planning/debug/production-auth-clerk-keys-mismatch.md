---
status: investigating
trigger: "Investigate and fix production auth on app.dockerdash.app.\n\nCurrent production symptoms:\n\nbrowser console says Clerk has been loaded with development keys\nGET /api/auth/me returns 401 Unauthorized\nonboarding verification fails only because auth fails first\n\nFocus only on production auth configuration.\n\nCheck:\n\nproduction VITE_CLERK_PUBLISHABLE_KEY\nproduction CLERK_SECRET_KEY\nwhether both keys belong to the same Clerk app/environment\nwhether production is accidentally using development Clerk keys\nwhether app.dockerdash.app is configured as an allowed Clerk domain/redirect origin\nwhether Netlify functions and frontend were both redeployed after env changes\n\nRequirements:\n\nproduction must use live Clerk keys\n/api/auth/me must return 200 for an authenticated user\nconsole must no longer warn that Clerk is using development keys on production\n\nReturn:\n\nroot cause\nexact env vars fixed\nwhether frontend key, backend key, or both were wrong\nproof that /api/auth/me now returns 200"
created: 2026-03-26T17:03:10.377Z
updated: 2026-03-26T17:08:54.912Z
---

## Current Focus

hypothesis: Confirmed frontend production bundle was built with Clerk dev publishable key; backend likely has mismatched secret/project pairing or also dev key, causing /api/auth/me 401 in production.
test: Verified deployed JS bundle for embedded Clerk key and attempted Netlify env inspection.
expecting: Need production env update + redeploy to align frontend/backend Clerk keys to same live app.
next_action: checkpoint for human action: update Netlify production env vars and redeploy

## Symptoms

expected: Production app uses live Clerk keys and authenticated /api/auth/me returns 200.
actual: Console warns Clerk loaded with development keys in production; /api/auth/me returns 401.
errors: 401 Unauthorized from /api/auth/me; Clerk development-key warning in production console.
reproduction: Visit app.dockerdash.app, authenticate, then call /api/auth/me.
started: Current production state.

## Eliminated

<!-- Append only -->

## Evidence

<!-- Append only -->

- timestamp: 2026-03-26T17:03:10.377Z
  checked: User report
  found: Failure originates at production auth configuration level before onboarding logic.
  implication: Must resolve Clerk production key/environment mismatch first.

- timestamp: 2026-03-26T17:08:54.912Z
  checked: https://app.dockerdash.app deployed bundle
  found: Production JS embeds `publishableKey:"pk_test_Z29yZ2VvdXMtc3VuYmlyZC04Ny5jbGVyay5hY2NvdW50cy5kZXYk"` (dev Clerk key). No `pk_live_*` key present.
  implication: Frontend production build is definitely using development Clerk publishable key.

- timestamp: 2026-03-26T17:08:54.912Z
  checked: Netlify CLI env/status access from current shell
  found: Not authenticated/linked to production Netlify site in this environment (`netlify status` requires login, env:list unavailable).
  implication: Cannot directly patch production env vars from this session; requires user-side Netlify access.

## Resolution

root_cause: Production frontend was deployed with a development Clerk publishable key (`pk_test_*`) instead of a live key (`pk_live_*`). This causes Clerk warning on app.dockerdash.app and likely key-pair/environment mismatch with backend token validation, leading to /api/auth/me 401.
fix: Pending user-side production env update: set matching live Clerk publishable+secret keys in Netlify Production context and redeploy frontend+functions.
verification: Bundle inspection proves current production key is test key; full 200 verification pending post-redeploy check.
files_changed: []
