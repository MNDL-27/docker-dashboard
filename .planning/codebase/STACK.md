# Technology Stack

## Languages & Runtime

| Layer | Language | Runtime |
|-------|----------|---------|
| Frontend | TypeScript (TSX) | Vite 5.4 + React 18.3 |
| Backend | TypeScript (.mts) | Netlify Functions (Node 20) |
| Shared | TypeScript | Imported by both frontend and backend |
| Agent | Bash | Linux systemd service (socat + curl + jq) |
| Database | SQL | PostgreSQL (Neon serverless driver) |

## Frontend Framework & Libraries

- **React 18.3** — UI framework with lazy-loaded routes via `React.lazy()`
- **Vite 5.4** — Build tool with SWC React plugin (`@vitejs/plugin-react-swc`)
- **React Router DOM 6.30** — Client-side routing; subdomain-aware (`isAppSubdomain`, `isDocsSubdomain`)
- **TailwindCSS 3.4** — Utility-first CSS with `tailwindcss-animate` plugin
- **shadcn/ui (Radix)** — UI component library (20+ Radix primitives configured in `components.json`)
- **TanStack React Query 5.83** — Server state management (query client in `App.tsx`)
- **Framer Motion 12.35** — Animations
- **Recharts 2.15** — Charting / data visualization for fleet metrics
- **Three.js 0.183** — 3D rendering (login page background effect)
- **Clerk React 5.61** — Authentication provider wrapping the app
- **date-fns 3.6** — Date formatting utilities
- **Sonner 1.7** — Toast notifications (alongside Radix toast)
- **Lucide React 0.462** — Icon library
- **Zod 3.25** — Schema validation (shared between frontend/backend)
- **cmdk 1.1** — Command palette component

## Backend Stack

- **Netlify Functions** — Serverless function handlers (`.mts` files in `netlify/functions/`)
- **@neondatabase/serverless 1.0** — PostgreSQL client (Neon serverless driver via `sql` tagged template)
- **@clerk/backend 3.2** — Server-side Clerk auth verification
- **Svix 1.88** — Webhook signature verification (Clerk webhooks)
- **Node crypto** — AES-256-GCM encryption for secrets at rest

## Billing

- **Paddle.js** — Payment processing (client-side SDK initialized in `App.tsx`)
- Paddle API key and webhook secret for server-side verification

## Database

- **PostgreSQL** on **Neon** (serverless)
- Schema defined in `netlify/schema.sql` (335 lines)
- Incremental migrations in `db-migrations/` (7 migration files)
- Connection string via `DATABASE_URL` env var

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build config with `@` path alias |
| `tailwind.config.ts` | TailwindCSS with custom design tokens (HSL CSS vars) |
| `postcss.config.js` | PostCSS with TailwindCSS + Autoprefixer |
| `tsconfig.json` | TypeScript project references |
| `tsconfig.app.json` | Frontend TypeScript config |
| `tsconfig.node.json` | Node-side TypeScript config |
| `eslint.config.js` | ESLint flat config with React hooks + refresh plugins |
| `netlify.toml` | Netlify build, dev server, redirects, security headers |
| `components.json` | shadcn/ui component configuration |
| `.env` / `.env.example` | Environment variables |

## Environment Variables (from `.env.example`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Frontend API base (defaults to `/api`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_ENCRYPTION_ACTIVE_KEY_ID` / `APP_ENCRYPTION_KEY_V1` | AES-256-GCM encryption for secrets at rest |
| `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk authentication |
| `CLERK_AUTHORIZED_PARTIES` | JWT audience validation |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Svix webhook verification |
| `PLATFORM_ADMIN_EMAILS` | Platform admin email allowlist |
| `REQUIRE_PLATFORM_APPROVALS` | Beta access gating toggle |
| `ALLOW_LOCAL_AGENT_URLS` | Dev flag to allow `http://localhost` agent URLs |
| `VITE_PADDLE_CLIENT_TOKEN` | Paddle billing client token |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Paddle server-side billing |
| `PRO_PRICE_ID` / `TEAM_PRICE_ID` | Paddle price IDs |

## Build & Deploy

- **Build**: `vite build` → `dist/`
- **Dev**: `netlify dev --port 8080` (proxies Vite on 8081 + Netlify Functions)
- **Deploy**: Netlify (automatic from Git)
- **Domains**: `dockerdash.app` (marketing), `app.dockerdash.app` (SPA), `docs.dockerdash.app` (docs)
