# Technology Stack

**Analysis Date:** 2026-04-20

## Languages

**Primary:**
- TypeScript - Frontend SPA and serverless backend (`src/App.tsx`, `src/pages/**/*.tsx`, `netlify/functions/**/*.mts`).

**Secondary:**
- SQL (Postgres dialect) - Schema and query layer (`netlify/schema.sql`, `netlify/functions/lib/*.mts`).
- JavaScript - Tooling/config glue (`eslint.config.js`, `postcss.config.js`).

## Runtime

**Environment:**
- Node.js 20 for build/dev (`netlify.toml`, `package.json`).
- Browser runtime for React app (`index.html`, `src/main.tsx`).

**Package Manager:**
- npm (scripts in `package.json`).
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**
- React 18 + React Router 6 (`package.json`, `src/App.tsx`) - SPA shell and route graph.
- Netlify Functions (`netlify/functions/*.mts`, `netlify.toml`) - API/backend surface.
- Clerk (`src/App.tsx`, `netlify/functions/lib/auth.mts`) - identity/session auth.

**Testing:**
- Vitest (`package.json`, tests in `src/lib/*.test.ts`, `netlify/functions/lib/*.test.ts`).

**Build/Dev:**
- Vite 5 (`vite.config.ts`, `package.json`) - frontend bundling.
- Tailwind CSS (`tailwind.config.ts`, `src/index.css`) - styling system.
- Netlify CLI (`package.json`, `netlify.toml`) - local full-stack dev and function routing.

## Key Dependencies

**Critical:**
- `@clerk/clerk-react`, `@clerk/backend` - auth in frontend and backend (`src/App.tsx`, `netlify/functions/lib/clerk.mts`).
- `@neondatabase/serverless` - database client for Neon/Postgres (`netlify/functions/lib/db.mts`).
- Paddle JS + Paddle webhooks - paid checkout and subscription status sync (`index.html`, `src/App.tsx`, `src/lib/pricing.ts`, `netlify/functions/api-billing-webhook.mts`).

**Infrastructure:**
- `svix` - Clerk webhook verification path (`package.json`, `netlify/functions/api-clerk-webhook.mts`).
- Resend HTTP API usage (no SDK) - transactional email (`netlify/functions/lib/email.mts`).
- Slack/webhook delivery modules - outbound alert integrations (`netlify/functions/api-slack-destinations.mts`, `netlify/functions/api-webhook-destinations.mts`).

## Configuration

**Environment:**
- Frontend reads pricing/auth/payment vars (`src/App.tsx`, `src/lib/pricing.ts`, `src/lib/api.ts`, `src/pages/app/BillingPage.tsx`).
- Backend reads auth, DB, crypto, webhook, and ops toggles (`netlify/functions/lib/auth.mts`, `netlify/functions/lib/db.mts`, `netlify/functions/lib/crypto.mts`, `netlify/functions/api-billing-webhook.mts`, `netlify/functions/api-host-health-poll.mts`).
- `.env*` files were not detected via workspace search; expected variables are documented in `README.md` and consumed in source files listed above.

**Build:**
- Deployment/runtime routing in `netlify.toml`.
- TS compile config in `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`.
- Lint and CSS pipeline in `eslint.config.js`, `postcss.config.js`, `tailwind.config.ts`.

## Platform Requirements

**Development:**
- Node 20 + npm install (`README.md`, `netlify.toml`, `package.json`).
- Netlify CLI workflow (`package.json` script `dev`, `netlify.toml`).
- Postgres connectivity via `NETLIFY_DATABASE_URL` (`netlify/functions/lib/db.mts`).

**Production:**
- Netlify-hosted SPA + Netlify Functions (`netlify.toml`, `netlify/functions/*.mts`).
- Clerk project, billing providers/webhooks, and DB connectivity required for full feature set (`netlify/functions/lib/auth.mts`, `netlify/functions/api-billing-webhook.mts`, `netlify/functions/lib/donor-billing.mts`).

## Pricing/Restriction Lens

- Plan/restriction catalog is centralized in frontend content (`src/lib/pricing.ts`, rendered by `src/pages/PricingPage.tsx`).
- Commercial checkout path is scoped to billing flows (`src/pages/app/BillingPage.tsx`, `netlify/functions/api-billing-webhook.mts`).
- Hard feature enforcement is **localized**, not broad sitewide: only advanced alert-rules mutations are explicitly plan-gated (`netlify/functions/api-alert-rules.mts`, `netlify/functions/lib/access-controls.mts`).
- Core app routing/auth does not gate most pages by plan (`src/App.tsx`, `src/components/ProtectedRoute.tsx`, `netlify/functions/auth-me.mts`).

---

*Stack analysis: 2026-04-20*
