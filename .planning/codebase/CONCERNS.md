# Concerns

## Current Risk Summary

This repo contains the full watcher path:
- Browser client in `src/`
- Netlify API/functions in `netlify/functions/`
- Host agent installer/runtime scripts in `public/watchtower-agent*.sh`

The highest current risks are watcher-specific:
- Fleet metrics are incomplete or silently wrong for some valid host configurations.
- Manual dashboard actions mutate host health state, which can hide outages.
- The host agent trusts broad request inputs once the shared API key is known.
- Observability UX can render synthetic data that looks real when backend metrics fail.

## High-Risk Concerns

### 1. Fleet metrics break for Cloudflare Access and non-default Docker socket hosts
- Evidence:
  - `netlify/functions/api-fleet-metrics.mts`
  - `public/watchtower-agent.sh`
- `fetchHostMetrics()` only sends `X-Agent-Key` to `/metrics`.
- It does not forward:
  - `CF-Access-Client-Id`
  - `CF-Access-Client-Secret`
  - `X-Docker-Socket`
- Result:
  - Tunnel hosts protected by Cloudflare Access can pass health checks but fail fleet metrics.
  - Hosts configured with a non-default Docker socket path can pass ping but report broken or empty metrics.
- Impact:
  - Fleet charts can undercount healthy hosts.
  - Operators can trust a dashboard that is missing part of the fleet.

### 2. Fleet metrics under-report busy hosts by sampling only the first 20 containers
- Evidence:
  - `public/watchtower-agent.sh`
  - `public/watchtower-agent-install.sh`
- The `/metrics` implementation caps container inspection with `head -20`.
- Result:
  - CPU, memory, network, and disk figures are partial on dense hosts.
- Impact:
  - Fleet-level resource charts become materially incorrect on real production hosts.
  - The error is silent; there is no field indicating the sample was truncated.

### 3. Dashboard can show mock resource history when the real metrics pipeline is failing
- Evidence:
  - `src/components/dashboard/FleetResourceChart.tsx`
  - `src/hooks/useFleetMetrics.ts`
- If the chart has no data, it seeds fabricated CPU/memory points.
- `useFleetMetrics()` also swallows backend failures and returns `[]`.
- Result:
  - Broken metrics collection can look like healthy low-variance telemetry.
- Impact:
  - This is an observability correctness failure, not just a UX issue.
  - Operators can make decisions from invented data.

### 4. Manual dashboard probes overwrite operational health state
- Evidence:
  - `netlify/functions/api-docker-proxy.mts`
  - `src/components/docker/AddHostDialog.tsx`
  - `src/pages/app/HostsPage.tsx`
  - `src/pages/app/HostDetailPage.tsx`
- `action === 'ping'` updates `docker_hosts.status` and `last_seen_at`.
- Org-wide container fetches also set host status directly.
- Result:
  - A manual “Test connection” or an incidental container refresh changes the same status fields used by scheduled health polling.
  - Failed manual probes still advance `last_seen_at`.
- Impact:
  - Staleness semantics are blurred.
  - Health status no longer means “last successful scheduled heartbeat”.

### 5. Agent permits caller-controlled socket override with full Docker API proxying
- Evidence:
  - `public/watchtower-agent.sh`
  - `netlify/functions/api-docker-proxy.mts`
- The agent accepts `X-Docker-Socket` and proxies arbitrary Docker paths once `X-Agent-Key` matches.
- The backend intentionally forwards stored `docker_socket_path`.
- Result:
  - Anyone holding the shared agent key can ask the agent to target alternate local Unix sockets.
  - The trust boundary is “knows the shared secret”, not “allowed to access only one daemon”.
- Impact:
  - This increases blast radius if an agent key leaks.
  - It also makes misconfiguration more dangerous than a fixed-socket agent design.

## Medium-Risk Concerns

### 6. CORS is permissive on both agent and serverless proxy layers
- Evidence:
  - `public/watchtower-agent.sh`
  - `netlify/functions/api-docker-proxy.mts`
  - `netlify/functions/api-docker-hosts.mts`
  - `netlify/functions/api-fleet-metrics.mts`
- Responses use `Access-Control-Allow-Origin: *`.
- The backend still requires auth, but the cross-origin posture is broader than necessary for a SaaS control plane.
- Impact:
  - Increases attack surface and makes future auth mistakes more costly.

### 7. Agent version drift detection is strict string equality only
- Evidence:
  - `shared/watchtower-agent-release.ts` (`isAgentVersionOutdated`)
  - `netlify/functions/lib/agent-version.mts`
- `isAgentVersionOutdated()` returns true for any string not exactly equal to `CURRENT_WATCHTOWER_AGENT_RELEASE.version`.
- Result:
  - Valid semver variants such as build metadata, patch suffixes, or forward-compatible versions are treated as outdated.
- Impact:
  - False positives in upgrade banners and host lists.

### 8. Host creation is write-first, test-later
- Evidence:
  - `src/components/docker/AddHostDialog.tsx`
  - `netlify/functions/api-docker-hosts.mts`
- The UI persists a host before connection testing.
- Result:
  - Bad URLs, wrong keys, or unreachable agents still create durable DB records.
- Impact:
  - Noise in host inventory and onboarding friction.

### 9. Health polling fans out to every host at once
- Evidence:
  - `netlify/functions/api-host-health-poll.mts`
- The cron job uses `Promise.allSettled(hosts.map(...))` with no concurrency cap.
- Result:
  - Large fleets can create bursty outbound traffic and function runtime pressure.
- Impact:
  - Scaling risk and noisy timeout behavior as fleet size grows.

### 10. Secret decryption or key rotation issues can surface as watcher outages
- Evidence:
  - `netlify/functions/lib/crypto.mts`
  - `netlify/functions/api-docker-proxy.mts`
  - `netlify/functions/api-host-health-poll.mts`
- Secret encryption is stronger than the previous map suggested, but the runtime hard-depends on correct keyring env configuration.
- Result:
  - Missing active keys, unknown legacy keys, or auth-tag mismatch incidents turn into host connectivity failures.
- Impact:
  - Operationally safe, but brittle without key rotation runbooks and alarms.

## Suggested Next Focus

1. Fix `api-fleet-metrics.mts` to send CF Access headers and `X-Docker-Socket`.
2. Remove synthetic chart seeding from `FleetResourceChart.tsx` and replace it with an explicit "no live metrics" state.
3. Separate health polling state from ad hoc UI probes so `last_seen_at` only means successful scheduled health.
4. Tighten the agent trust boundary:
   - disable arbitrary socket overrides by default
   - restrict allowed sockets to an explicit allowlist if override support must remain
5. Rework `/metrics` so it either reports complete host totals or explicitly reports sampling/truncation metadata.
