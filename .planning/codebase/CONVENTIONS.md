# Conventions

## Baseline

- Frontend code is TypeScript-first with React function components, TanStack Query for async state, and `@/` path aliases wired through Vite and Vitest.
- Netlify functions use ESM `.mts` files with a consistent `export default async (req: Request)` entrypoint and `export const config: Config = { path: ... }`.
- Shared agent version logic is intentionally centralized in [`shared/agent-version.ts`](../../shared/agent-version.ts), then re-exported into both frontend and Netlify code.
- Styling is utility-first Tailwind with shadcn/ui primitives; component variants are typically handled with `class-variance-authority` and `cn()`.

## TypeScript And React Patterns

- Pages default-export a `*Page` component from `src/pages/**`.
- Hooks live in `src/hooks/` and wrap TanStack Query or mutation flows rather than exposing raw fetch logic to pages.
- Service modules such as [`src/services/docker-api.ts`](../../src/services/docker-api.ts) are thin API wrappers over [`src/lib/api.ts`](../../src/lib/api.ts).
- Query keys are simple string arrays like `['docker-hosts', orgId]`; refetch intervals are encoded close to the hook.
- Type assertions are used when crossing the API boundary; there is not a strong runtime validation layer on the frontend.

## Backend Function Shape

- Netlify handlers generally follow this shape:
  - define CORS/JSON headers at module scope
  - early-return for `OPTIONS`
  - authenticate via [`requireAuth`](../../netlify/functions/lib/auth.mts) unless the endpoint is intentionally public
  - return plain JSON payloads and ad-hoc `{ error, details? }` error objects
- SQL is written inline with tagged Neon queries in the handler rather than hidden behind repository classes.
- Cross-cutting helpers live under `netlify/functions/lib/` and are imported directly into handlers.

## Naming And File Layout

- `api-*.mts` is the convention for HTTP handlers under `netlify/functions/`.
- Shared server utilities use lower camel or descriptive kebab naming depending on age of the filebase; the repo is not fully uniform here.
- Public operational assets for the host agent live in `public/` so they can be served directly to installing hosts.
- Database evolution is tracked in `db-migrations/`, while bootstrap schema assets remain under `netlify/`.

## Linting And Quality Guardrails

- ESLint is configured through [`eslint.config.js`](../../eslint.config.js) with the base TypeScript recommended rules plus React Hooks and React Refresh rules.
- `@typescript-eslint/no-unused-vars` is disabled repo-wide, which lowers friction but also makes dead parameters and abandoned refactors easier to miss.
- There is no dedicated formatting tool checked in, so style consistency depends on editor defaults and contributor discipline.
- The repo currently has some stale docs and generated-looking text, so documentation should not be treated as authoritative without checking the code.

## Watcher-Specific Conventions

- The watcher agent is implemented as shell, not Node or Go. The production runtime contract is the HTTP surface exposed by [`public/watchtower-agent.sh`](../../public/watchtower-agent.sh).
- The installer at [`public/watchtower-agent-install.sh`](../../public/watchtower-agent-install.sh) embeds its own copy of the runtime script instead of sourcing or packaging the public script. That is a major maintenance constraint: every agent behavior change must be kept in sync twice.
- Agent requests are header-driven:
  - `X-Agent-Key` authenticates requests from Netlify to the host agent.
  - `X-Docker-Socket` optionally overrides the Docker socket path.
- The backend assumes the agent exposes both `/docker/*` proxy routes and `/agent/version`; that contract is duplicated again in [`netlify/functions/api-mock-docker-agent.mts`](../../netlify/functions/api-mock-docker-agent.mts).

## Quality Gaps To Respect

- The public agent script and the installer-embedded runtime have already drifted:
  - the installer copy trims header values more defensively before matching `X-Agent-Key`, `X-Docker-Socket`, and `Content-Length`
  - the public script still uses the older `case "header: value"` parsing, which is more brittle against formatting differences
- The agent parses Docker JSON with `grep`, `sed`, `cut`, and `awk` instead of a JSON parser. That keeps dependencies light, but it makes correctness depend on Docker response shape and whitespace assumptions.
- Because the installer writes the runtime via heredoc, reviewing watcher changes requires checking both the public script and the embedded copy, not just one file.
- Any future watcher work should prefer a single source of truth for the runtime or an automated sync check; otherwise regressions are likely to recur.
