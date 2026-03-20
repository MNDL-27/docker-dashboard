# Stack

## Languages & Runtime

| Layer | Language | Version |
|-------|----------|---------|
| Frontend | TypeScript | ^5.8.3 |
| Backend (Netlify Functions) | TypeScript (.mts) | ^5.8.3 |
| Database | SQL (PostgreSQL) | Neon Serverless |
| Build tooling | Node.js | 20 (set in `netlify.toml`) |

## Frontend Framework

- **React** ^18.3.1 — SPA with client-side routing
- **Vite** ^5.4.19 — Build tool with `@vitejs/plugin-react-swc` for fast compilation
- **React Router DOM** ^6.30.1 — Client-side routing with nested layout routes

## UI Framework

- **TailwindCSS** ^3.4.17 — Utility-first CSS with `tailwindcss-animate` plugin
- **shadcn/ui** — ~50 Radix-based components in `src/components/ui/`
- **class-variance-authority** ^0.7.1 — Component variant management
- **Framer Motion** ^12.35.0 — Animations and transitions
- **Lucide React** ^0.462.0 — Icon library
- **Recharts** ^2.15.4 — Data visualization / charting
- **Three.js** ^0.183.2 — 3D particle background on login page (`LoginBackground.tsx`)

## State Management & Data Fetching

- **TanStack React Query** ^5.83.0 — Server state management, caching, polling
- **React Hook Form** ^7.61.1 + **Zod** ^3.25.76 — Form management and validation
- No global client-side state management library (component-local state + React Query)

## Backend

- **Netlify Functions** — Serverless functions in `netlify/functions/` (`.mts` extension)
- **@neondatabase/serverless** ^1.0.2 — Database client (tagged template literal SQL)
- **@clerk/backend** ^3.2.0 — Server-side auth verification
- **svix** ^1.88.0 — Webhook signature verification for Clerk events
- **Node.js crypto** — AES-256-GCM encryption for secrets at rest

## Authentication

- **Clerk** — Full auth provider
  - Frontend: `@clerk/clerk-react` ^5.61.3
  - Backend: `@clerk/backend` ^3.2.0
  - Webhook sync via Svix

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build config, `@` path alias to `./src` |
| `tailwind.config.ts` | Dark mode (class-based), custom color tokens via CSS vars |
| `netlify.toml` | Build settings, API redirect rules, dev server config |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | TypeScript config |
| `eslint.config.js` | Flat ESLint config with React rules |
| `postcss.config.js` | PostCSS with TailwindCSS + Autoprefixer |
| `components.json` | shadcn/ui configuration |
| `.env` / `.env.example` | Environment variables |

## Package Manager

- **npm** (primary, `package-lock.json` present)
- **Bun** lockfiles also present (`bun.lock`, `bun.lockb`) — likely used locally

## Dev Dependencies (Notable)

- **Vitest** ^3.2.4 — Test runner with jsdom environment
- **@testing-library/react** ^16.0.0 — React component testing
- **netlify-cli** ^24.2.0 — Local Netlify dev server
- **lovable-tagger** ^1.1.13 — Component tagging (dev-only Vite plugin)
