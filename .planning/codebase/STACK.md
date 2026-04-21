# Technology Stack

**Analysis Date:** 2026-04-22

## Languages & Runtime

| Layer | Language | Runtime / Host |
|-------|----------|----------------|
| Frontend | TypeScript / TSX | React 18.3 on Vite 5.4 in the browser |
| Backend | TypeScript / `.mts` plus a few `.mjs` helpers | Netlify Functions on Node 20 |
| Shared | TypeScript | Imported by both `src/` and `netlify/functions/` |
| Agent | Bash | Linux host runtime installed by `systemd` |
| Database | SQL | PostgreSQL via Neon serverless driver |
| Tests | TypeScript | Vitest 2.x |

## Frontend Stack

- `react`, `react-dom`, and `react-router-dom` power the SPA routed from `src/App.tsx`.
- `@clerk/clerk-react` wraps the app in `ClerkProvider` for auth and organization context in `src/App.tsx`.
- `@tanstack/react-query` provides server-state caching and polling for hooks in `src/hooks/`.
- Tailwind CSS plus `tailwindcss-animate` and shadcn/Radix primitives drive styling through `tailwind.config.ts`, `src/index.css`, and `src/components/ui/`.
- `framer-motion`, `recharts`, `three`, `cmdk`, `sonner`, and `lucide-react` support motion, charts, the login visual treatment, command-style interactions, notifications, and icons.
- `react-hook-form` and `@hookform/resolvers` are used for typed form flows such as onboarding and dedicated intake screens.

## Backend and Platform Stack

- Netlify Functions under `netlify/functions/` implement the API surface, auth endpoints, webhook handlers, and scheduled jobs.
- `@neondatabase/serverless` is the database client used by `netlify/functions/lib/db.mts`.
- `@clerk/backend` and `svix` support server-side auth verification and Clerk webhook signature validation in `netlify/functions/lib/auth.mts` and `netlify/functions/api-clerk-webhook.mts`.
- Node `crypto` backs secret encryption in `netlify/functions/lib/crypto.mts`.
- `@asteasolutions/zod-to-openapi` generates the API spec in `shared/schema/api.ts`, served by `netlify/functions/api-docs.mts`.
- `netlify/functions/lib/security.mts` adds trusted-origin CORS, shared DB-backed rate limiting, and webhook replay protection.

## Product-Specific Runtime Pieces

- `public/watchtower-agent.sh` is the Bash runtime that proxies Docker socket traffic on customer hosts.
- `public/watchtower-agent-install.sh` and `public/watchtower-agent-uninstall.sh` manage install, update, and remove flows for that runtime.
- `shared/watchtower-agent-release.ts` and `scripts/prepare-watchtower-agent-release.mjs` manage version metadata and release packaging.
- `netlify/functions/api-dedicated-deployments.mts` plus `netlify/functions/lib/dedicated-deployments.mts` add the managed dedicated-deployment path alongside the self-serve product flow.
- `netlify/functions/lib/donor-billing.mts`, `netlify/functions/lib/email.mts`, and related handlers support donor-premium billing and reminder email operations.

## Database and Schema Shape

- The base schema lives in `netlify/schema.sql`.
- Incremental migrations live in `db-migrations/`, with 9 timestamped SQL migrations in the current repo state.
- Runtime schema bootstrapping helpers such as `ensure-alerts-schema.mts`, `ensure-dedicated-deployment-schema.mts`, and `ensure-admin-schema.mts` keep newer tables and columns present at request time.
- The data model covers orgs, members, Docker hosts and secrets, agent enrollments, alerts/incidents, donor billing events, donor email deliveries, and security rate-limit/nonces tables.

## Tooling and Quality Stack

- `typescript`, `vite`, and `@vitejs/plugin-react-swc` provide the build pipeline.
- `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh` provide linting through `eslint.config.js`.
- `vitest` is configured through the package script `npm test` and co-located `*.test.ts` files under `src/`, `shared/`, and `netlify/functions/lib/`.
- `netlify-cli` is the local platform/dev runner behind `npm run dev`.

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Scripts, dependencies, and runtime metadata |
| `vite.config.ts` | Vite build config and `@/*` alias wiring |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript project configuration |
| `tailwind.config.ts` | Tailwind theme extension and content scanning |
| `postcss.config.js` | PostCSS pipeline |
| `eslint.config.js` | Flat ESLint config |
| `netlify.toml` | Redirects, scheduled jobs, and local dev/build behavior |
| `components.json` | shadcn UI alias/config metadata |
| `.env.example` | Non-secret environment variable template |

## Environment Variable Families

- Frontend/API base: `VITE_API_BASE_URL`
- Database and encryption: `DATABASE_URL`, `APP_ENCRYPTION_ACTIVE_KEY_ID`, `APP_ENCRYPTION_KEY_*`
- Clerk auth: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CLERK_JWT_KEY`
- Platform access controls: `PLATFORM_ADMIN_EMAILS`, `REQUIRE_PLATFORM_APPROVALS`, `ALLOW_LOCAL_AGENT_URLS`
- Paddle billing: `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENV`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PRO_PRICE_ID`, `TEAM_PRICE_ID`
- Donor billing and donation links: `LIBERAPAY_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_SECRET`, `VITE_DONATION_URL`, `VITE_PAYPAL_DONATION_URL`
- Transactional email: `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `RESEND_API_KEY`, `DONOR_REMINDER_CRON_SECRET`

## Build, Dev, and Deployment

- `npm run dev` and `npm run dev:local` start Netlify dev on port `8080`, proxying Vite on `8081`.
- `npm run build` runs `vite build` and emits the frontend bundle to `dist/`.
- `npm run release:agent` prepares watchtower-agent release metadata.
- `npm test` runs `vitest run`.
- `netlify.toml` rewrites `/api/*` and `/auth/*`, schedules `api-host-health-poll` every minute, and schedules `api-donor-reminders` daily.

## Domains and Runtime Surface

- `dockerdash.app` is the public marketing/root experience.
- `app.dockerdash.app` is the protected app subdomain.
- `docs.dockerdash.app` serves the docs experience through a rewrite to the SPA.
- `src/App.tsx` switches behavior by hostname through `isAppSubdomain()`, `isDocsSubdomain()`, and preview-auth bypass helpers.

---

*Technology stack refresh: 2026-04-22*
