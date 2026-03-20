---
created: 2026-03-20T15:48:48.555Z
title: Hostname-based routing split marketing and app subdomains
area: ui
files:
  - src/App.tsx
  - src/components/ProtectedRoute.tsx
  - src/pages/LandingPage.tsx
  - src/pages/LoginPage.tsx
  - netlify.toml
---

## Problem

The Docker Dashboard app currently serves both the marketing site and the authenticated product from the same hostname and router. The user wants to split behavior by hostname:

- **`dockerdash.app`** — Marketing landing page (existing marketing routes)
- **`app.dockerdash.app`** — Product entrypoint (authenticated dashboard)
- On `app.dockerdash.app`, visiting `/` should redirect logged-out users to auth and logged-in users to the dashboard

### Requirements

1. `dockerdash.app` stays the marketing landing page
2. `app.dockerdash.app` is the product entrypoint
3. On `app.dockerdash.app`, `/` sends logged-out users to auth page, logged-in users to dashboard
4. Do not break existing routes, auth, or Clerk setup
5. Keep the same Netlify site deployment (single deploy, hostname detection in frontend)
6. Use hostname detection in the frontend router/app shell
7. Add safe fallback for local development so `localhost` still works normally
8. After implementing, list exactly which routes/behavior changed

### Key Constraints

- Single Netlify deployment serves both subdomains
- Clerk auth must work on both domains (may need domain config in Clerk dashboard)
- API routes (`/api/*`) must work from both hostnames
- Netlify redirect rules in `netlify.toml` remain unchanged

## Solution

1. Create a hostname detection utility (e.g., `src/lib/hostname.ts`) that checks `window.location.hostname` and returns whether the current context is "marketing" or "app"
2. In `src/App.tsx`, conditionally render marketing routes vs app routes based on detected hostname
3. On the app subdomain, override `/` to be the `ProtectedRoute`-wrapped dashboard (redirect unauthenticated to `/login`, authenticated to `/app`)
4. On the marketing domain, keep `/` as `LandingPage` (current behavior)
5. `localhost` and development should default to showing all routes (current behavior) as a safe fallback
6. Clerk `allowedRedirectOrigins` may need updating to include `app.dockerdash.app`
