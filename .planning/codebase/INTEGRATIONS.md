# External Integrations

**Analysis Date:** 2026-04-20

## APIs & External Services

**Identity & Auth:**
- Clerk - session auth and org context.
  - SDK/Client: `@clerk/clerk-react`, `@clerk/backend` (`src/App.tsx`, `netlify/functions/lib/clerk.mts`, `netlify/functions/lib/auth.mts`).
  - Auth: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `CLERK_AUTHORIZED_PARTIES` (`src/App.tsx`, `netlify/functions/lib/auth.mts`).

**Billing & Payments:**
- Paddle checkout and subscription webhooks - paid plan checkout and org billing status updates.
  - SDK/Client: Paddle JS script + direct webhook handler (`index.html`, `src/App.tsx`, `netlify/functions/api-billing-webhook.mts`).
  - Auth: `VITE_PADDLE_CLIENT_TOKEN`, Paddle price env vars, `PADDLE_WEBHOOK_SECRET` (`src/lib/pricing.ts`, `netlify/functions/api-billing-webhook.mts`).
- PayPal/Liberapay donor pathway - manual donor premium grant flow.
  - SDK/Client: custom webhook parsing in donor billing module (`netlify/functions/api-billing-webhook-paypal.mts`, `netlify/functions/api-billing-webhook-liberapay.mts`, `netlify/functions/lib/donor-billing.mts`).
  - Auth: provider webhook secret headers validated against provider-specific env vars (`netlify/functions/lib/donor-billing.mts`).

**Alerts Destinations:**
- Slack incoming webhooks and generic outbound webhooks for alert delivery.
  - SDK/Client: internal delivery modules (`netlify/functions/api-slack-destinations.mts`, `netlify/functions/api-webhook-destinations.mts`, `netlify/functions/lib/slack-delivery.mts`, `netlify/functions/lib/webhook-destinations.mts`).
  - Auth: user-supplied destination credentials/URLs are stored and used by backend delivery modules.

## Data Storage

**Databases:**
- Neon Postgres (serverless Postgres).
  - Connection: `NETLIFY_DATABASE_URL` (`netlify/functions/lib/db.mts`).
  - Client: `@neondatabase/serverless` (`netlify/functions/lib/db.mts`).

**File Storage:**
- Local repository files for frontend assets/build artifacts; no cloud object storage integration detected in source.

**Caching:**
- Not detected as a dedicated external cache service.

## Authentication & Identity

**Auth Provider:**
- Clerk.
  - Implementation: frontend Clerk provider + backend token authentication mapped to internal user/org records (`src/App.tsx`, `netlify/functions/lib/auth.mts`, `netlify/functions/auth-me.mts`).

## Monitoring & Observability

**Error Tracking:**
- No external error-tracking SaaS detected.

**Logs:**
- Function-level console logging and security event logging utilities (`netlify/functions/api-billing-webhook.mts`, `netlify/functions/api-clerk-webhook.mts`, `netlify/functions/lib/security.mts`).

## CI/CD & Deployment

**Hosting:**
- Netlify for SPA hosting, redirects, scheduled functions, and serverless functions (`netlify.toml`).

**CI Pipeline:**
- Not detected as repository-native workflow files (`.github/workflows/**` not present).

## Environment Configuration

**Required env vars:**
- Core/auth/data: `NETLIFY_DATABASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY` (`netlify/functions/lib/db.mts`, `src/App.tsx`, `netlify/functions/lib/auth.mts`).
- Billing: `VITE_PADDLE_CLIENT_TOKEN`, Paddle price IDs, `PADDLE_WEBHOOK_SECRET` (`src/App.tsx`, `src/lib/pricing.ts`, `netlify/functions/api-billing-webhook.mts`).
- Donor flow: provider webhook secrets, donation URL overrides (`netlify/functions/lib/donor-billing.mts`, `src/pages/app/BillingPage.tsx`).
- Ops/security/email: `HEALTH_POLL_SECRET`, `DONOR_REMINDER_CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_PROVIDER`, encryption key vars (`netlify/functions/api-host-health-poll.mts`, `netlify/functions/api-donor-reminders.mts`, `netlify/functions/lib/email.mts`, `netlify/functions/lib/crypto.mts`).

**Secrets location:**
- Environment variables provided to Netlify Functions/frontend build; secrets are read from `process.env` and not hardcoded (`netlify/functions/**/*.mts`, `src/**/*.ts*`).

## Webhooks & Callbacks

**Incoming:**
- `/api/billing/webhook` (Paddle) (`netlify/functions/api-billing-webhook.mts`).
- `/api/billing/webhook/paypal` and `/api/billing/webhook/liberapay` (`netlify/functions/api-billing-webhook-paypal.mts`, `netlify/functions/api-billing-webhook-liberapay.mts`).
- Clerk webhook endpoint (`netlify/functions/api-clerk-webhook.mts`).

**Outgoing:**
- Resend email API (`netlify/functions/lib/email.mts`).
- Slack webhook posts (`netlify/functions/lib/slack-delivery.mts`).
- Generic webhook destination posts (`netlify/functions/lib/webhook-destinations.mts`).

## Pricing Restriction Enforcement Lens

- Pricing restrictions are defined and marketed in frontend pricing models (`src/lib/pricing.ts`, `src/pages/PricingPage.tsx`).
- Billing state is written into organization records by checkout/donor webhooks (`netlify/functions/api-billing-webhook.mts`, `netlify/functions/lib/donor-billing.mts`, `netlify/functions/auth-me.mts`).
- Enforcement appears **localized**, not sitewide: explicit plan-gated backend checks are present for advanced alert rule mutation (`netlify/functions/api-alert-rules.mts`, `netlify/functions/lib/access-controls.mts`).
- No broad, cross-endpoint plan/seat/node quota middleware was detected across core host/member/org endpoints (`netlify/functions/api-docker-hosts.mts`, `netlify/functions/api-members.mts`, `netlify/functions/api-organizations.mts`).

---

*Integration audit: 2026-04-20*
