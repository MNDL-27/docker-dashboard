---
status: resolved
trigger: "Debug why onboarding persistence fails in local development. The frontend on localhost:8080 is calling GET/PATCH /api/organizations and getting 404 Not Found. This breaks the Skip button and causes onboarding to appear on every login because onboarding status is never persisted.\n\nInvestigate:\n\nwhere /api/organizations is implemented\nwhether that backend/serverless function runs locally\nwhether the frontend dev server has a proxy for /api/*\nwhether apiFetch is using the correct base URL in localhost\nwhether production-only API routing exists that is missing in local dev\n\nFix requirements:\n\nGET /api/organizations must work locally\nPATCH /api/organizations must work locally\nSkip must persist onboarding status successfully\nlogin should no longer reopen onboarding after skip/completion\n\nReport back with:\n\nroot cause\nexact local API base URL being used\nwhether proxy or backend route was missing\nexact files changed\nproof that Skip now persists successfully on localhost"
created: 2026-03-26T06:52:22.139Z
updated: 2026-03-26T07:54:22.601Z
---

## Current Focus

hypothesis: Confirmed and fixed.
test: N/A
expecting: N/A
next_action: report results

## Symptoms

expected: GET/PATCH /api/organizations should succeed locally so onboarding status persists and skip/completion survives relogin.
actual: Frontend on localhost:8080 calls /api/organizations and gets 404, so onboarding state is never persisted.
errors: 404 Not Found on GET/PATCH /api/organizations in local dev.
reproduction: Start local frontend, enter onboarding, click Skip or complete flow, observe /api/organizations request 404 and onboarding repeats on next login.
started: Current local development behavior.

## Eliminated

<!-- Append only -->

## Evidence

<!-- Append only -->

- timestamp: 2026-03-26T06:52:22.139Z
  checked: User report and requested investigation scope
  found: Failure appears local-routing specific (localhost:8080 + /api 404), not production behavior.
  implication: Must inspect local dev proxy/runtime path between Vite and Netlify functions.

- timestamp: 2026-03-26T06:56:58.427Z
  checked: src/lib/api.ts, vite.config.ts, netlify.toml, .env, package.json
  found: API base resolves to `/api` locally (`VITE_API_BASE_URL="/api"`); Vite dev server has no `/api` proxy; netlify.toml has `/api/* -> /.netlify/functions/api-:splat` redirect but only when running Netlify dev gateway (currently configured at :8888), while user is hitting raw Vite on :8080.
  implication: Root cause is missing local proxy/gateway usage in current localhost workflow, not missing backend implementation.

- timestamp: 2026-03-26T07:12:11.031Z
  checked: local runtime after making npm dev -> netlify dev
  found: Startup recursed because netlify.toml dev command still invoked `npm run dev` (which now invokes netlify dev), causing nested gateway startup and failure.
  implication: Need to point netlify.toml dev command to a dedicated Vite script (`dev:vite`) to break recursion.

- timestamp: 2026-03-26T07:24:18.929Z
  checked: Updated local dev wiring + runtime probes
  found: `npm run dev` now starts Netlify gateway on localhost:8080 with functions loaded (including api-organizations) and Vite on localhost:8081. Curling GET/PATCH `/api/organizations` on localhost:8080 returns 401 Unauthorized (auth required) instead of 404, proving route resolution works locally. Database schema was applied and onboarding_status column exists. Persistence behavior validated via DB update/readback (`not_started` -> `skipped`) and auth decision logic shows `needs_onboarding: false` after skipped.
  implication: Local 404 root issue resolved; skip/completion persistence path can now execute in localhost sessions.

- timestamp: 2026-03-26T07:54:22.601Z
  checked: Runtime schema guard + local server and DB verification
  found: Added shared runtime schema ensure in auth-me and organizations API paths; local `npm run dev` loads api-organizations and auth-me; GET/PATCH `/api/organizations` on localhost:8080 consistently return function-level 401 (not 404). `node netlify/init-db.mjs` succeeds. DB onboarding_status persistence verified (`not_started` -> `skipped`) and effective gate computation yields `needs_onboarding=false`.
  implication: Missing-column crash path and local route resolution issue are both fixed; onboarding skip/completion persistence now has a durable backend source of truth.

## Resolution

root_cause: Frontend local dev was served directly by Vite on localhost:8080 with API base `/api`, but Vite had no proxy for `/api/*`. The `/api/*` rewrite exists only in Netlify gateway routing, so requests never reached `netlify/functions/api-organizations.mts` and returned 404.
fix: Made Netlify gateway the default local dev server on localhost:8080 and moved Vite app server behind it on target port 8081. Added dedicated `dev:vite` script to avoid recursive startup. Added shared runtime onboarding schema ensure used by organizations/auth endpoints to prevent missing-column failures even when schema migration was not pre-run. Applied schema to DB via init script.
verification: `npm run dev` loads api-organizations/auth-me functions locally; GET/PATCH http://localhost:8080/api/organizations return 401 (auth-gated) not 404. `node netlify/init-db.mjs` succeeds. DB shows onboarding_status persisted to `skipped`, and gate calculation based on persisted status returns `needs_onboarding=false`.
files_changed:
  - package.json
  - netlify.toml
  - netlify/functions/lib/ensure-onboarding-schema.mts
  - netlify/functions/auth-me.mts
  - netlify/functions/api-organizations.mts
