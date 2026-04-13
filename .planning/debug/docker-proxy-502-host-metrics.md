---
status: awaiting_human_verify
trigger: "Investigate issue: docker-proxy-502-host-metrics"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T21:13:38.3910414+05:30
---

## Current Focus

hypothesis: Confirmed. Host metrics failures were being misclassified as generic 502, and client-side query retries amplified repeated request bursts.
test: Validate targeted unit test coverage and static checks for touched files.
expecting: Host metrics failure status now reflects upstream status and host metrics query no longer performs automatic retries.
next_action: user verification in production workflow on /app/hosts

## Symptoms

expected: Host metrics should load successfully for selected Docker host.
actual: Repeated /api/docker-proxy 502 responses from production, query retries keep firing.
errors: Browser console shows POST https://app.dockerdash.app/api/docker-proxy 502 (Bad Gateway). Also shows Permissions-Policy warnings and Profitwell ERR_BLOCKED_BY_CLIENT noise.
reproduction: Navigate to https://app.dockerdash.app/app/hosts while authenticated; host metrics query triggers docker-proxy POST and fails with 502.
started: Unknown from user; user requested diagnosis from codebase.

## Eliminated

## Evidence

- timestamp: 2026-04-13T21:11:16.3831650+05:30
	checked: src/services/docker-api.ts and src/hooks/useHostMetrics.ts via code search
	found: Host metrics query calls dockerApi.hostMetrics(hostId), which invokes POST /api/docker-proxy with action='host-metrics'.
	implication: The 502 symptom is on the exact path used by host metrics rendering; issue is likely in docker-proxy host-metrics handling or upstream connectivity.

- timestamp: 2026-04-13T21:11:16.3831650+05:30
	checked: netlify/functions/api-docker-proxy.mts (top-level helpers)
	found: dockerFetch maps network failures to 502 with 'Agent connection failed', maps timeouts to 504, and streams response payload with a 4MB cap.
	implication: Repeated 502 likely indicates upstream fetch failure rather than frontend parse/normalization errors.

- timestamp: 2026-04-13T21:12:31.8173566+05:30
	checked: netlify/functions/api-docker-proxy.mts host-metrics action
	found: Any non-OK response from /metrics is rewritten to 502, even when dockerFetch already returned a more specific status (for example 504 timeout or 404 endpoint missing).
	implication: Production surfaces misleading 502s for multiple root failure modes, making diagnosis harder and inflating false bad-gateway reports.

- timestamp: 2026-04-13T21:12:31.8173566+05:30
	checked: src/hooks/useHostMetrics.ts and src/services/docker-api.ts
	found: Host metrics query uses react-query defaults, so failed requests are retried before the regular polling interval.
	implication: Persistent upstream failures create rapid retry bursts (in addition to interval polling), matching the observed repeated requests.

- timestamp: 2026-04-13T21:13:38.3910414+05:30
	checked: src/hooks/useHostMetrics.test.ts
	found: Focused test run passed (2/2 tests).
	implication: Host metrics normalization behavior remains stable after retry policy change.

- timestamp: 2026-04-13T21:13:38.3910414+05:30
	checked: npm run lint
	found: Lint fails due to many pre-existing errors in unrelated files; no new lint issue reported in edited files for this fix.
	implication: Global lint is currently red in repository baseline, so verification uses targeted test + code inspection for changed areas.

## Resolution

root_cause:
	Host metrics action in api-docker-proxy rewrote every non-OK upstream /metrics response to status 502, masking real causes like timeout (504) or missing endpoint (404). On the client, useHostMetrics default react-query retries produced repeated rapid POST /api/docker-proxy failures.
fix:
	1) Updated api-docker-proxy host-metrics branch to preserve upstream status and include structured details/upstream_status in error response.
	2) Updated useHostMetrics query to set retry=false so failures do not trigger immediate retry bursts.
verification:
	- vitest run src/hooks/useHostMetrics.test.ts passes.
	- Code inspection confirms host-metrics now returns metricsResponse.status instead of always 502.
files_changed: ["netlify/functions/api-docker-proxy.mts", "src/hooks/useHostMetrics.ts"]
