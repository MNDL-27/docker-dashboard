# Testing

## Current Harness

- The repo uses Vitest with a `jsdom` environment through [`vitest.config.ts`](../../vitest.config.ts).
- Test setup is limited to [`src/test/setup.ts`](../../src/test/setup.ts), which installs `@testing-library/jest-dom` and a `window.matchMedia` mock.
- The configured include glob is `src/**/*.{test,spec}.{ts,tsx}`.

## Actual Coverage State

- `rg` over `src/`, `netlify/`, and `public/` did not find any `*.test.*` or `*.spec.*` files.
- That means the repo currently has test infrastructure but effectively no committed automated tests.
- The previous codebase map was stale here: it referenced a placeholder test file that is no longer present.

## What Is Testable Today

- Frontend unit and component tests can be added immediately under `src/` with Vitest + Testing Library.
- Pure shared logic such as [`shared/agent-version.ts`](../../shared/agent-version.ts) also fits the existing Vitest setup.
- Netlify function tests are not covered by the current include glob because those handlers live under `netlify/functions/` and rely on server/runtime concerns not yet modeled in the test setup.
- Shell scripts in `public/` have no harness at all; there is no `shellcheck`, `shfmt`, `bats`, or equivalent in the repo.

## Highest-Value Missing Tests

- Frontend:
  - query hook tests for [`src/hooks/useDocker.ts`](../../src/hooks/useDocker.ts), especially enabled flags and refetch intervals
  - API wrapper tests for [`src/services/docker-api.ts`](../../src/services/docker-api.ts) and [`src/lib/api.ts`](../../src/lib/api.ts)
  - component tests around host connection flows and agent update prompts
- Backend:
  - request-building and timeout behavior in [`netlify/functions/api-docker-proxy.mts`](../../netlify/functions/api-docker-proxy.mts)
  - auth and org-access behavior in [`netlify/functions/api-docker-hosts.mts`](../../netlify/functions/api-docker-hosts.mts)
  - health-state transitions in the host polling path
- Watcher:
  - contract tests for `/docker/_ping`, `/docker/version`, `/metrics`, and `/agent/version`
  - regression tests for header parsing, especially whitespace, casing normalization, and `Content-Length`
  - fixtures covering Docker stats payload variations so the shell parsing does not silently break

## Watcher-Specific Quality Risks

- The agent runtime exists in two places:
  - [`public/watchtower-agent.sh`](../../public/watchtower-agent.sh)
  - the heredoc-installed runtime inside [`public/watchtower-agent-install.sh`](../../public/watchtower-agent-install.sh)
- Those copies are already inconsistent. The installer copy contains stricter header parsing than the public script, which means fixes can land in one runtime and not the other.
- The `/metrics` implementation is shell-driven and parses JSON with `grep`/`sed`/`awk`. This is brittle against response shape changes, nested field ordering, or unexpected whitespace.
- There is no automated test proving that the Netlify proxy, mock agent, and shipped shell agent all honor the same HTTP contract.

## Practical Testing Roadmap

1. Add fast unit tests for `shared/agent-version.ts` and the request-builder helpers in `api-docker-proxy.mts`.
2. Expand Vitest coverage to selected server files, or add a parallel server-focused config that can run handler tests under Node.
3. Introduce shell validation:
   - `shellcheck` in CI for `public/watchtower-agent*.sh`
   - a small Bats suite or equivalent contract script for agent endpoints and header parsing
4. Add one end-to-end smoke path using the mock agent to verify host add -> ping -> version/update detection.

## Bottom Line

- The project has testing dependencies, but no meaningful automated test coverage today.
- The watcher/agent path is the sharpest gap because it mixes shell parsing, duplicated runtime sources, and cross-boundary HTTP contracts without regression tests.
