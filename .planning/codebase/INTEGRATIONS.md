# External Integrations

**Analysis Date:** 2026-04-22

## Clerk Authentication and Organizations

**Integration type:** hosted identity, org membership, JWT verification, webhook sync

- Frontend auth flows through `@clerk/clerk-react` in `src/App.tsx`.
- Backend auth resolution runs through `netlify/functions/lib/auth.mts` and `netlify/functions/lib/clerk.mts`.
- Clerk webhooks are handled by `netlify/functions/api-clerk-webhook.mts`, which validates Svix signatures and syncs user/org state into Postgres.
- `netlify/functions/auth-me.mts` is the key bridge endpoint that turns Clerk session data into app-specific user, org, onboarding, and dedicated-deployment state.

## Neon PostgreSQL

**Integration type:** primary application database

- The backend uses direct SQL through `@neondatabase/serverless` in `netlify/functions/lib/db.mts`.
- Base schema is defined in `netlify/schema.sql`; incremental changes live in `db-migrations/*.sql`.
- Runtime bootstrapping helpers such as `ensure-alerts-schema.mts`, `ensure-dedicated-deployment-schema.mts`, and `ensure-admin-schema.mts` keep the DB shape compatible with deployed code.
- Core persisted domains include organizations, members, Docker hosts, encrypted host secrets, agent enrollments, alerts/incidents, donor billing events, donor email deliveries, and security rate-limit/nonces state.

## Paddle Billing

**Integration type:** subscription billing for paid plans

- `src/App.tsx` initializes Paddle.js using `VITE_PADDLE_CLIENT_TOKEN`.
- `netlify/functions/api-billing-webhook.mts` handles Paddle webhook events server-side.
- Billing UI lives in `src/pages/app/BillingPage.tsx`, while backend access decisions are enforced in `netlify/functions/lib/access-controls.mts`.
- Environment/config touchpoints include `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PRO_PRICE_ID`, and `TEAM_PRICE_ID`.

## Donor Billing Providers

**Integration type:** manual or semi-automatic donor-premium activation

- `netlify/functions/api-donor-intent.mts` issues donor reference tokens for manual payment flows.
- `netlify/functions/api-billing-webhook-liberapay.mts` and `api-billing-webhook-paypal.mts` ingest provider callbacks.
- `netlify/functions/lib/donor-billing.mts` matches events, extends donor premium, records billing events, and coordinates email delivery.
- The admin UI in `src/pages/app/AdminPage.tsx` supports manual reconciliation and donor email resend actions.
- Current providers/config are Liberapay, PayPal, and donation link variables in `.env.example`.

## Resend Transactional Email

**Integration type:** outbound donor lifecycle email delivery

- `netlify/functions/lib/email.mts` sends mail through Resend when `EMAIL_PROVIDER=resend`.
- Email template generation lives in `netlify/functions/lib/donor-email-templates.mts`.
- Reminder scheduling runs through `netlify/functions/api-donor-reminders.mts`, and the schedule is declared in `netlify.toml`.
- Admin resend actions use the same provider path and audit the retry in donor email delivery tables.

## Watchtower Agent

**Integration type:** self-hosted edge agent for Docker control and host telemetry

- Browser requests never talk to Docker directly. They call backend handlers such as `netlify/functions/api-docker-proxy.mts`, `api-docker-hosts.mts`, and `api-fleet-metrics.mts`.
- The backend connects to the customer-hosted Bash agent in `public/watchtower-agent.sh`, authenticated with `X-Agent-Key`.
- Secrets are stored encrypted in Postgres and decrypted server-side in `netlify/functions/lib/crypto.mts`.
- Supported remote operations include Docker ping/version, container listing/inspect/stats/logs/start/stop/restart, host metrics, and agent version reporting.
- Guided host bootstrap is handled by `netlify/functions/api-agent-enrollments.mts`, with install/runtime helpers in `public/watchtower-agent-install.sh`, `public/watchtower-agent.sh`, and `shared/watchtower-agent-release.ts`.

## Cloudflare Tunnel and Access

**Integration type:** optional network transport in front of the Watchtower agent

- The app does not call Cloudflare APIs directly.
- Instead, host records can be configured for `cloudflare_tunnel`, and the backend forwards optional `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers when those secrets are stored for a host.
- URL and mode validation lives in `netlify/functions/lib/host-url.mts` and related host/enrollment flows.

## Alert Delivery Destinations

**Integration type:** outbound notifications

- Generic webhook destinations are managed by `netlify/functions/api-webhook-destinations.mts` and delivered via `netlify/functions/lib/webhook-destinations.mts`.
- Slack incoming webhooks are managed by `netlify/functions/api-slack-destinations.mts` and delivered via `netlify/functions/lib/slack-delivery.mts`.
- Delivery attempts are persisted for audit and retry visibility.

## Netlify Platform Features

**Integration type:** hosting, routing, scheduled execution

- `netlify.toml` rewrites `/api/*` to `/.netlify/functions/api-:splat` and `/auth/*` to `/.netlify/functions/auth-:splat`.
- Scheduled jobs currently invoke `api-host-health-poll` every minute and `api-donor-reminders` daily.
- Local development uses `netlify dev` with Vite on port `8081` and the Netlify proxy on `8080`.

## OpenAPI / API Documentation Surface

**Integration type:** generated API description

- `shared/schema/api.ts` registers API shapes with `@asteasolutions/zod-to-openapi`.
- `netlify/functions/api-docs.mts` serves the generated document at `/api/api-docs`.
- Current documented surface is focused on the Docker proxy contract and RFC 7807 style error responses from `shared/schema/error.ts`.

## Security and Edge Controls

**Integration type:** shared cross-request security helpers

- `netlify/functions/lib/security.mts` applies trusted-origin CORS, database-backed rate limiting, and webhook replay protection.
- Webhook and high-volume endpoints such as `api-clerk-webhook.mts`, `api-billing-webhook.mts`, and `api-docker-proxy.mts` depend on those helpers.
- This is not a third-party service integration by itself, but it is a cross-cutting platform boundary used by multiple external-entry endpoints.

---

*Integration map refresh: 2026-04-22*
