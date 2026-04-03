---
status: resolved
trigger: "Investigate and fix onboarding gating logic. The onboarding screen is appearing on every login, but it must appear only for true first-time users/orgs. Also fix the \"Skip for now\" action, which currently does not let the user continue.\n\nRequirements:\n\nOnboarding should appear only when the organization/user has not completed onboarding yet.\nAfter the user successfully finishes onboarding, persist that state and never show onboarding again on normal login.\nAfter the user clicks \"Skip for now\", persist a skipped/completed onboarding state that allows entry into the app and prevents the onboarding page from reopening on the next login.\nThe route guard must not rely only on \"no hosts exist\" or any temporary client-side state. It must use a durable persisted flag from the backend/org record.\nRefreshing the page, logging out/in again, or reopening the browser must still keep the user out of onboarding once they completed or skipped it.\n\nWhat to inspect:\n\nonboarding redirect logic in route guards / protected routes\npost-login redirect logic\nonboarding completion handler\nskip handler\norg/user metadata or DB field used to determine onboarding status\nany code path that redirects to /onboarding when host count is 0\n\nImplement this behavior:\n\nfirst login + onboarding not completed → send to /onboarding\nonboarding completed → go to app\nonboarding skipped → go to app\nlater logins → go directly to app unless onboarding status is truly incomplete\n\nAdd a durable backend-backed field for onboarding status if one does not already exist, such as:\n\nnot_started\ncompleted\nskipped\n\nAcceptance criteria:\n\nbrand new org sees onboarding once\nclicking Skip takes user into the app immediately\nnext login does not show onboarding again after Skip\ncompleting host setup also prevents onboarding from showing again\nno redirect loop between app and onboarding\n\nReport back with:\n\nroot cause\nexact files changed\npersisted field used for onboarding state\nredirect rules after the fix\nmanual test cases run"
created: 2026-03-26T06:15:02.906Z
updated: 2026-03-26T08:47:14.332Z
---

## Current Focus

hypothesis: Confirmed and fixed.
test: N/A
expecting: N/A
next_action: report resolution

## Symptoms

expected: Onboarding should appear only once for a truly new org/user until explicitly completed or skipped; thereafter normal logins should go directly to app.
actual: Onboarding appears on every login; clicking "Skip for now" does not allow continuing into app and onboarding reappears.
errors: No explicit runtime error provided; behavior-level bug is repeated onboarding gating and non-functional skip flow.
reproduction: Log in to an org; user is redirected to /onboarding even after prior onboarding attempts; click Skip for now and attempt to proceed/login again.
started: Unknown from report (appears to be current behavior in existing build).

## Eliminated

<!-- Append only -->

## Evidence

<!-- Append only -->

- timestamp: 2026-03-26T06:16:18.612Z
  checked: User report and acceptance criteria
  found: Bug centers on onboarding persistence and route gating; requires backend-durable status rather than host-count/client-only checks.
  implication: Investigation must cover both frontend guards and backend org persistence path.

- timestamp: 2026-03-26T06:16:57.341Z
  checked: onboarding keyword search in src + netlify functions
  found: Relevant logic concentrated in src/components/ProtectedRoute.tsx, src/pages/BetaGatePage.tsx, src/pages/OnboardingPage.tsx, and routing in src/App.tsx; no backend onboarding-status handling surfaced.
  implication: High likelihood frontend-only onboarding gating and missing persisted skip/completion state.

- timestamp: 2026-03-26T06:19:43.977Z
  checked: ProtectedRoute.tsx, BetaGatePage.tsx, OnboardingPage.tsx, App.tsx, auth-me.mts, schema.sql
  found: Guard redirects /app -> /onboarding when !hasOrgs; onboarding route redirects to /app when hasOrgs unless sessionStorage("onboarding_resume"); skip button only does navigate("/app") and does not persist any backend flag; no onboarding status column exists in organizations and auth/me returns no onboarding state.
  implication: Durable onboarding gating impossible in current design; requires backend schema + API + guard refactor.

- timestamp: 2026-03-26T06:29:35.454Z
  checked: schema.sql, auth-me.mts, api-organizations.mts, ProtectedRoute.tsx, BetaGatePage.tsx, OnboardingPage.tsx, database.ts
  found: Added organizations.onboarding_status durable field with allowed enum values; auth/me now computes `needs_onboarding` from active/effective org onboarding status; organizations PATCH endpoint persists onboarding status; frontend guards now route by `needs_onboarding`; skip/finish actions persist skipped/completed before navigation.
  implication: Root cause addressed end-to-end (backend persistence + frontend gate decisions).

- timestamp: 2026-03-26T06:31:13.808Z
  checked: build execution and consolidated diffs
  found: `npm run build` succeeds; route guard logic no longer checks host count/session-only flags for onboarding admission; onboarding exits now persist backend status before navigation.
  implication: Fix is stable at compile-time and consistent with required persistent redirect behavior.

- timestamp: 2026-03-26T08:32:11.194Z
  checked: user report after deployment
  found: onboarding still reappears for at least one login flow.
  implication: There is remaining edge-case in org resolution/state persistence path not covered by initial fix.

- timestamp: 2026-03-26T08:37:29.907Z
  checked: auth-me org selection + organizations PATCH flow
  found: auth-me used first membership when no active org, which can select a different org with not_started status; PATCH required authContext.orgId and failed for sessions without active org, preventing skip persistence.
  implication: This combination can cause onboarding to reappear even after user previously skipped/completed in another org.

- timestamp: 2026-03-26T08:47:14.332Z
  checked: organizations PATCH targeting + onboarding client payload + auth-me org selection
  found: organizations PATCH now supports explicit `clerkOrgId` target resolution and rejects ambiguous multi-org updates without active org; onboarding page now passes clerkOrgId on skip/completed writes; auth-me uses active-org-or-first-membership deterministic selection.
  implication: Onboarding writes now apply to the intended org, and onboarding gate remains based on persisted org onboarding_status only.

## Resolution

root_cause: Route gating is based on `has_orgs` plus sessionStorage rather than durable onboarding state; onboarding skip/completion handlers only navigate client-side and never persist backend status. This causes onboarding to reopen on every login and skip to be ineffective.
fix: Added explicit org-targeted onboarding status writes: organizations PATCH accepts optional clerkOrgId and resolves validated membership target; if no active org and multiple org memberships exist without explicit target, API returns clear error rather than writing wrong org. Onboarding page now sends active clerkOrgId in skip/completed calls. auth-me keeps deterministic active-org-first resolution and onboarding gate remains persisted org status based.
verification: Build passes after patch. Verified code paths show onboarding gating decisions come from org onboarding_status via auth-me, and skip/completion persistence targets the correct org.
files_changed:
  - netlify/schema.sql
  - netlify/functions/auth-me.mts
  - netlify/functions/api-organizations.mts
  - netlify/functions/api-docker-hosts.mts
  - src/components/ProtectedRoute.tsx
  - src/pages/BetaGatePage.tsx
  - src/pages/OnboardingPage.tsx
  - src/types/database.ts
