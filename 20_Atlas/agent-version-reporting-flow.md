# Agent Version Reporting Flow

## Flow
- Hosts are created with `agent_version = null` in `docker_hosts`.
- The add-host flow saves `host_url`, then calls the ping endpoint to test the new host.
- The health poller and the manual ping flow both call `GET {host_url}/agent/version`.
- The agent runtime and the mock agent return JSON with both `agent_version` and `version`.
- On success, the backend writes `docker_hosts.agent_version = COALESCE(fetched_version, existing_value)`.

## Runtime Endpoint
- Real agent: `/agent/version`
- Mock agent: `/api/mock-docker-agent/agent/version`
- Expected response shape:
  - `{"agent_version":"1.0.0","version":"1.0.0"}`

## Why the UI Shows `Version pending`
- The UI renders `Version pending` when `host.agent_version` is falsy.
- That can happen when polling never ran, the ping failed, the host URL is wrong, the agent is unreachable, or `/agent/version` is missing/blocked.
- If the poller succeeds but the endpoint returns no version field, the DB value stays null and the UI remains pending.

## Evidence
- `src/pages/app/HostDetailPage.tsx`
- `src/components/docker/AddHostDialog.tsx`
- `netlify/functions/api-host-health-poll.mts`
- `netlify/functions/api-docker-proxy.mts`
- `public/watchtower-agent.sh`
- `public/watchtower-agent-install.sh`
- `netlify/functions/api-mock-docker-agent.mts`
- `netlify/schema.sql`
- `db-migrations/20260404000000_add_agent_version_to_docker_hosts.sql`
