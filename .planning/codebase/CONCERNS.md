# Codebase Concerns

**Analysis Date:** 2026-04-22

## Tech Debt

**Monolithic frontend workspaces:**
- Issue: Several user-facing screens combine data loading, mutation handling, formatting helpers, and large UI trees in single files.
- Files: `src/components/hosts/HostWorkspace.tsx`, `src/pages/app/AdminPage.tsx`, `src/pages/DocsPage.tsx`, `src/pages/onboarding/useOnboardingState.ts`, `src/components/docker/AddHostDialog.tsx`
- Impact: Feature work and bug fixes are high-risk because small changes require reasoning across hundreds of lines of mixed concerns. Reuse is low and targeted tests are difficult to add.
- Fix approach: Split by responsibility first: extract query/state hooks, isolate action dialogs, and move presentational cards/sections into focused subcomponents before adding more behavior.

**Duplicated agent runtime logic:**
- Issue: The shipped runtime exists twice: once as `public/watchtower-agent.sh` and again as a large heredoc embedded inside `public/watchtower-agent-install.sh`.
- Files: `public/watchtower-agent.sh`, `public/watchtower-agent-install.sh`
- Impact: Runtime fixes can land in one copy and miss the other. The divergence is already visible: `public/watchtower-agent.sh` includes `validate_docker_path` and `json_escape`, while the embedded runtime in `public/watchtower-agent-install.sh` uses a different request parser and omits the same hardening path.
- Fix approach: Generate the installer from a single runtime source or template so request validation, metrics behavior, and versioning cannot drift.

## Known Bugs

**Protected route hook order is invalid:**
- Symptoms: `eslint` fails with `react-hooks/rules-of-hooks`, and the component can become unstable if the preview-auth bypass branch changes render flow.
- Files: `src/components/ProtectedRoute.tsx`
- Trigger: The component returns early when `isPreviewAuthBypassEnabled()` is true, before its `useEffect` call.
- Workaround: None in code. The component should be refactored so all hooks run before any conditional return.

**Admin operations reuse billing form state:**
- Symptoms: The "Secret migration" form writes its reason into `billingForm.reason`, which is also used by the billing override UI.
- Files: `src/pages/app/AdminPage.tsx`
- Trigger: Switching between Billing and Operations tabs mixes state for unrelated workflows and can clear or overwrite the other form's reason text.
- Workaround: Re-enter the reason before submitting. The page needs isolated form state per operation.

**Organizations page swallows create failures:**
- Symptoms: Organization creation can fail with no user feedback.
- Files: `src/pages/app/OrganizationsPage.tsx`
- Trigger: `handleCreate` uses an empty `catch {}` block, so Clerk/API failures disappear silently.
- Workaround: Retry manually and inspect browser/network logs. The page should surface an error toast or inline message.

## Security Considerations

**Runtime hardening can drift between public and installed agent code:**
- Risk: The installed runtime embedded in `public/watchtower-agent-install.sh` can miss security fixes added to `public/watchtower-agent.sh`, especially around path parsing and request sanitation.
- Files: `public/watchtower-agent.sh`, `public/watchtower-agent-install.sh`
- Current mitigation: The agent still requires `X-Agent-Key`, validates the Docker socket path on startup, and runs behind a dedicated system user.
- Recommendations: Eliminate the duplicate runtime source and keep request validation in one audited script.

**Long-lived credentials are intentionally revealed in edit/setup flows:**
- Risk: Sensitive connection secrets are loaded into the browser for editing and advanced manual install flows.
- Files: `src/components/docker/AddHostDialog.tsx`, `src/pages/onboarding/useOnboardingState.ts`
- Current mitigation: Secrets are masked by default in the UI, and the guided enrollment flow avoids exposing the long-lived API key unless the user chooses the advanced/manual path.
- Recommendations: Minimize secret round-trips, gate reveal actions more explicitly, and keep the advanced/manual path clearly marked as an exception.

## Performance Bottlenecks

**N+1 host queries on organizations listing:**
- Problem: Each rendered organization card issues its own `useDockerHosts(org.id)` query.
- Files: `src/pages/app/OrganizationsPage.tsx`
- Cause: `OrgCard` fetches host data independently instead of consuming a shared organization-host summary.
- Improvement path: Fetch organization summaries once, or pre-group host data in a parent query before rendering cards.

**Large client-side admin and host views:**
- Problem: High-traffic screens do significant computation and render branching in one pass.
- Files: `src/components/hosts/HostWorkspace.tsx`, `src/pages/app/AdminPage.tsx`, `src/pages/app/ContainersPage.tsx`, `src/pages/app\ContainerDetailPage.tsx`
- Cause: Query orchestration, derived data, modal state, and UI composition are all colocated in single components.
- Improvement path: Extract derived selectors and expensive sections into smaller components/hooks so React work is narrower and easier to memoize where needed.

## Fragile Areas

**Host connection and enrollment flow:**
- Files: `src/components/docker/AddHostDialog.tsx`, `src/pages/onboarding/useOnboardingState.ts`, `src/services/agent-enrollment.ts`, `src/services/docker-api.ts`, `src/lib/api.ts`
- Why fragile: The flow spans browser state, enrollment sessions, credential handling, retry logic, and post-install verification. The code currently depends on several `any`-typed errors and generic response handling.
- Safe modification: Change one step at a time, keep API contracts explicit, and add focused tests around enrollment create/finalize responses before reshaping UI behavior.
- Test coverage: No direct tests cover the guided install flow, edit-host secrets flow, or enrollment retries.

**Agent shell scripts:**
- Files: `public/watchtower-agent.sh`, `public/watchtower-agent-install.sh`, `public/watchtower-agent-uninstall.sh`
- Why fragile: Business-critical runtime behavior lives in Bash, including metrics collection, Docker proxying, install/update paths, and service management.
- Safe modification: Treat the runtime and installer as release artifacts. Validate both direct-mode and tunnel-mode flows after any change and keep the runtime source single-sourced.
- Test coverage: No automated tests cover the shell scripts.

## Scaling Limits

**Frontend maintainability scales poorly with new product areas:**
- Current capacity: Several core pages are already very large: `src/components/hosts/HostWorkspace.tsx` (1081 lines), `src/pages/DocsPage.tsx` (952 lines), `src/pages/app/AdminPage.tsx` (904 lines), `src/pages/app/ContainersPage.tsx` (472 lines), `src/components/settings/OrganizationMembersWorkspace.tsx` (471 lines).
- Limit: Adding more host/admin/billing behaviors to the same files will keep increasing regression surface and review cost.
- Scaling path: Formalize page-level composition boundaries now so new work lands in extracted modules rather than extending the existing monoliths.

## Dependencies at Risk

**Lint compliance is already broken against the current stack:**
- Risk: The codebase has 37 `eslint` errors and 10 warnings under the current toolchain, including hook-order violations, `no-explicit-any`, `no-empty-object-type`, `no-empty`, and unsafe optional chaining.
- Impact: Refactors and dependency upgrades become harder because the baseline is already red, and new issues can hide inside existing failures.
- Migration plan: Restore a clean lint baseline in the highest-risk app files first: `src/components/ProtectedRoute.tsx`, `src/components/docker/AddHostDialog.tsx`, `src/components/hosts/HostWorkspace.tsx`, `src/pages/app/ContainerDetailPage.tsx`, `src/pages/app/ContainersPage.tsx`, `src/pages/app/LogsPage.tsx`, `src/pages/app/OrganizationsPage.tsx`, `tailwind.config.ts`.

## Missing Critical Features

**No automated coverage for core onboarding and admin flows:**
- Problem: The repository contains only two test files, both in `src/lib/`, while the most failure-prone flows are UI and integration heavy.
- Blocks: Safe iteration on host enrollment, protected routing, admin actions, secret migration UI, and agent script updates.

**No automated verification for shipped shell artifacts:**
- Problem: The agent installer/runtime/uninstaller are production deliverables but have no smoke tests or contract checks in-repo.
- Blocks: Confident agent releases and safe refactors of install/update logic.

## Test Coverage Gaps

**App-shell and route guards are untested:**
- What's not tested: Auth/onboarding gating, preview bypass behavior, dedicated deployment redirects, and retry handling.
- Files: `src/components/ProtectedRoute.tsx`, `src/components/RequireAppSubdomain.tsx`, `src/components/RequirePlatformAdmin.tsx`
- Risk: Route regressions can lock users out or send them to the wrong setup path unnoticed.
- Priority: High

**Host management and container workflows are untested:**
- What's not tested: Add/edit host, secrets loading, ping/finalize flows, container logs, container stats, and host metrics rendering.
- Files: `src/components/docker/AddHostDialog.tsx`, `src/components/hosts/HostWorkspace.tsx`, `src/pages/app/LogsPage.tsx`, `src/pages/app/ContainersPage.tsx`, `src/pages/app\ContainerDetailPage.tsx`
- Risk: The highest-value operational features can regress without any automated signal.
- Priority: High

**Admin control-plane actions are untested:**
- What's not tested: User approvals, suspensions, org lock/unlock, billing overrides, donor reconciliation, donor email retries, and secret migration submissions.
- Files: `src/pages/app/AdminPage.tsx`, `src/hooks/useAdmin.ts`, `src/services/admin-api.ts`
- Risk: Internal operations can make destructive or access-affecting changes with only manual validation.
- Priority: High

**Only utility-layer tests exist today:**
- What's not tested: Everything outside narrow helpers for API error formatting and host status normalization.
- Files: `src/lib/api.test.ts`, `src/lib/host-health-state.test.ts`
- Risk: The current test suite does not protect the workflows that drive revenue, onboarding, and host operations.
- Priority: Medium

---

*Concerns audit: 2026-04-22*
