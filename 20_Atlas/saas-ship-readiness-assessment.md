# SaaS Ship Readiness Assessment

## Verdict
- As of 2026-04-17, the codebase is not ready for a public SaaS launch.
- It is closer to a private beta or founder-led pilot: the core product works, but billing, entitlement enforcement, trust/compliance messaging, and launch operations are not finished.

## Evidence Summary
- Billing is incomplete:
  - `src/pages/app/BillingPage.tsx` still shows invoice history and self-serve plan switching as under development.
  - The cancel subscription button is present but has no implemented action.
- Plan limits look unenforced server-side:
  - `src/pages/PricingPage.tsx` advertises plan-based host/user/retention differences.
  - `netlify/functions/lib/access-controls.mts` enforces approval, suspension, org lock, and host quarantine, but not plan quotas/features.
- Customer-visible placeholders remain:
  - `src/pages/DocsPage.tsx` explicitly lists billing/subscriptions and multiple app areas as placeholders.
- Security/compliance copy overclaims:
  - `src/pages/SecurityPage.tsx` claims SOC 2 Type II and GDPR compliance without corresponding evidence in repo.
- Platform admin is hardcoded:
  - `netlify/functions/lib/platform-admin.mts` grants platform admin by static email allowlist.
- Host URLs are not validated before server-side fetches:
  - `netlify/functions/api-docker-hosts.mts` stores `host_url` directly.
  - `netlify/functions/api-docker-proxy.mts` and `netlify/functions/api-host-health-poll.mts` fetch those URLs from the backend, which is an SSRF risk until restricted.
- Launch ops are thin:
  - Root `package.json` has no `test` script.
  - `npm run lint` currently fails with 36 errors.
  - Netlify config builds the frontend, but there is no visible CI workflow or automated migration path in repo.

## Must-Have Before Launch
- Finish billing lifecycle: cancel, change plan, invoice/history, and customer billing management.
- Enforce entitlements server-side for hosts, seats, retention, API access, and paid-only features.
- Hide or complete placeholder routes and settings before exposing them to paying customers.
- Add host URL validation / outbound target restrictions to reduce SSRF risk.
- Replace hardcoded platform admin rules with config or database-backed admin controls.
- Remove unsupported compliance/security claims or back them with real controls and evidence.
- Add CI, tests, and a migration/deploy runbook suitable for production.

## Can Wait After Launch
- Deeper deployment-history workflows.
- Tenant-facing audit-log UX if it is not sold in v1.
- Expanded help center and richer support surfaces.
- Extra notification channels such as Discord.

## 2026-04-17 Implementation Update
- Added centralized host target validation in `netlify/functions/lib/host-url.mts`.
- Applied host URL validation to host create/edit, guided enrollment, docker proxy, host health poller, fleet metrics, and alerts-driven agent fetches.
- Added outbound validation for generic webhook destinations and strict Slack webhook validation.
- Replaced hardcoded platform-admin emails with `PLATFORM_ADMIN_EMAILS`.
- Added `ALLOW_LOCAL_AGENT_URLS` for local development and mock-agent flows.
- Reduced the customer-facing v1 surface:
  - Removed Monitoring, Incidents, and Deployments from sidebar navigation.
  - Redirected those legacy app routes away from placeholder pages.
  - Reduced Settings to shipped tabs only.
  - Removed Discord placeholder exposure from Notifications.
- Rewrote public `Features`, `Security`, `Contact`, and in-app `Help` pages to match currently supportable functionality.

## Remaining High-Value Work
- Billing lifecycle and entitlement enforcement are still open.
- Tenant-facing plaintext secret round-tripping is still present through `includeSecrets=true` for host editing.
- Authenticated API CORS remains broad on multiple endpoints.
- Lint still fails in unrelated pre-existing areas, and CI/test automation is still missing.
