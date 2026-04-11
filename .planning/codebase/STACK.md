# Stack

## Runtime Shape

- Frontend: React 18 SPA built with Vite 5 and TypeScript 5, served as static assets.
- Backend: Netlify Functions written as ESM TypeScript (`.mts`) behind `/api/*` and `/auth/*` rewrites.
- Database: Neon Postgres reached with `@neondatabase/serverless`.
- Host-side watcher: Bash-based Watchtower Agent distributed as static shell scripts from `public/` and installed onto Linux hosts as a `systemd` service.

## Frontend

- React 18.3.1 with `react-router-dom` 6 for SPA routing and subdomain-aware entry routing in `src/App.tsx`.
- `@tanstack/react-query` is the main data layer; host, container, and fleet polling are driven by query refetch intervals.
- UI stack is Tailwind CSS 3 plus shadcn/ui-style Radix primitives in `src/components/ui/`.
- Supporting UI libraries include `framer-motion`, `lucide-react`, `recharts`, `sonner`, and `three`.
- Vite uses `@vitejs/plugin-react-swc`; `lovable-tagger` is enabled only in development.

## Auth And Identity

- Auth is Clerk, not custom JWT auth.
- Frontend uses `@clerk/clerk-react` via `ClerkProvider`.
- Netlify functions use `@clerk/backend` to authenticate bearer tokens and map Clerk IDs to local `users` and `organizations` rows.
- The app still keeps its own org/member tables in Postgres for authorization and app state.

## Backend And Serverless

- Netlify Functions live in `netlify/functions/`.
- Main app APIs cover orgs, members, profile, docker hosts, docker proxying, fleet metrics, host health polling, billing webhook handling, and admin utilities.
- Shared backend helpers in `netlify/functions/lib/` handle DB access, Clerk auth, onboarding checks, host-health status transitions, encryption, platform admin checks, and agent version comparison.

## Data And Persistence

- Postgres schema is defined in `netlify/schema.sql`, with migrations in `db-migrations/`.
- Core app tables: `users`, `organizations`, `organization_members`, `docker_hosts`, `docker_host_secrets`, `mock_agent_config`.
- Sensitive host credentials are stored separately from host metadata in `docker_host_secrets`.
- Host secret values are encrypted in the app layer with AES-256-GCM and key rotation support via `APP_ENCRYPTION_ACTIVE_KEY_ID` and `APP_ENCRYPTION_KEY_*`.

## Watcher / Agent Subsystem

- Distributed artifacts:
  - `public/watchtower-agent-install.sh`
  - `public/watchtower-agent.sh`
  - `public/watchtower-agent-uninstall.sh`
  - `public/watchtower-dev-connector.sh` as a legacy shim
- The dashboard surfaces install commands from `OnboardingPage` and `SetupGuidePage`, defaulting to `https://app.dockerdash.app/watchtower-agent-install.sh` outside local dev.
- The installer writes the runtime to `/opt/watchtower-agent/watchtower-agent.sh`, protected config to `/etc/watchtower-agent/watchtower-agent.env`, and a `systemd` unit at `/etc/systemd/system/watchtower-agent.service`.
- The runtime is a small Bash HTTP server built with `socat` plus `curl` against the local Docker Unix socket.
- Auth between dashboard backend and agent is a shared `AGENT_API_KEY` sent as `X-Agent-Key`.
- Optional socket overrides are sent as `X-Docker-Socket`.
- The agent exposes:
  - `/docker/*` as a proxy to the local Docker Engine API
  - `/agent/version` for installer/runtime version reporting
  - `/metrics` for fleet CPU, memory, network, and disk aggregation

## Deployment And Hosting

- Netlify hosts the SPA and functions.
- `netlify.toml` defines:
  - build command `npm run build`
  - publish directory `dist`
  - API rewrites to Netlify functions
  - host-based redirects for `dockerdash.app`, `www.dockerdash.app`, and `docs.dockerdash.app`
- Local development uses `netlify dev` on port 8080 with Vite served behind it on port 8081.

## Billing And Other App Services

- Billing UI is wired to Paddle client-side initialization through `VITE_PADDLE_CLIENT_TOKEN`.
- Clerk webhooks are verified with Svix.

## Testing And Tooling

- Vitest with jsdom is configured for frontend tests.
- Testing Library packages are installed.
- ESLint uses the flat config format with React hooks and refresh plugins.
- `npm` is the practical package manager in repo scripts; Bun lockfiles also exist but are secondary.
