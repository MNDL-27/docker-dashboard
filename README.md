# Docker Watchtower Dashboard

A self-hosted Docker fleet management dashboard. Monitor containers, view logs, and track host health across your infrastructure — all from a single pane of glass.

**Stack:** React · Vite · Tailwind CSS · Netlify Functions · Neon Postgres

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | ≥ 20 | [Install via nvm](https://github.com/nvm-sh/nvm#installing-and-updating) |
| **npm** | ≥ 9 | Bundled with Node.js |
| **Neon Postgres database** | — | Free tier works. [Create one at neon.tech](https://neon.tech) |
| **Netlify CLI** | ≥ 17 | Installed automatically as a dev dependency |

---

## 1. Clone & Install

```sh
git clone https://github.com/MNDL-27/docker-watchtower-dash.git
cd docker-watchtower-dash
npm install
```

---

## 2. Configure Environment Variables

Copy the example file and fill in your values:

```sh
cp .env.example .env
```

Then edit `.env`:

```env
# ── Frontend ──────────────────────────────────────────────
VITE_API_BASE_URL="/api"
# The base path for API requests. Leave as "/api" for local
# development and production on Netlify.

# ── Database ──────────────────────────────────────────────
NETLIFY_DATABASE_URL="postgresql://<user>:<password>@<host>/neondb?sslmode=require"
# Your Neon Postgres connection string. Find it in the Neon
# dashboard under "Connection Details". Use the pooled
# connection string for best performance.

# ── Authentication ────────────────────────────────────────
JWT_SECRET="replace-with-a-long-random-string"
# Secret used to sign and verify JWT tokens. Generate one:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ── Health Poller ─────────────────────────────────────────
HEALTH_POLL_SECRET="replace-with-another-random-string"
# Shared secret that authorizes calls to the host health
# polling endpoint. Used by the scheduled cron job (or
# manual invocations in local dev).
```

> **All four variables are required.** The app will not boot without `NETLIFY_DATABASE_URL` and `JWT_SECRET`.

---

## 3. Initialize the Database

The repository includes a schema file and an initialization script. Run it once against your empty Neon database:

```sh
node netlify/init-db.mjs
```

**What this does:** Executes `netlify/schema.sql`, which creates the `users`, `organizations`, `organization_members`, `docker_hosts`, `docker_host_secrets`, and `mock_agent_config` tables, along with triggers and helper functions.

> ⚠️ **This script assumes a blank database.** If tables already exist, it will fail. To reset, drop and recreate the `public` schema in the Neon console first.

---

## 4. Start the Application

```sh
npx netlify dev
```

This boots:
- The **Vite dev server** on port 8080 (frontend hot-reload)
- The **Netlify Functions server** on port 8888 (API + serverless functions)

Open **http://localhost:8888** in your browser.

---

## 5. First-Login Flow

1. Click **Start Free** or navigate to `/signup`.
2. Enter your **full name**, **email**, and **password**.
3. Click **Sign up**. You'll be redirected to the login page.
4. Log in with the credentials you just created.

---

## 6. Create Your Organization

After your first login, the dashboard will prompt you:

1. Click **Create Organization**.
2. Enter an organization name (e.g., `My Team`).
3. Click **Create Organization** again to confirm.

You'll land on the main dashboard, ready to add hosts.

---

## 7. Add Your First Docker Host

Navigate to **Infrastructure → Hosts** in the sidebar, then click **Connect Host**.

| Field | What to Enter |
|---|---|
| **Connection Method** | `Agent (Direct)` — for a Watchtower Agent on the host |
| **Host Name** | A friendly label, e.g. `prod-server-01` |
| **Agent URL** | The HTTPS URL where your agent is running (e.g. `https://your-host:9876`) |
| **Docker Socket Path** | Leave as `/var/run/docker.sock` unless non-standard |
| **Agent API Key** | The shared secret configured on your agent |

Click **Save & Test Connection**. The dashboard saves the host and immediately pings it.

### ⚠️ UI Note: "Agent API Key" During Local Testing

The **Agent API Key** field is mandatory in the UI. When testing locally against the built-in mock agent (`http://localhost:8888/api/mock-docker-agent`), enter **any non-empty string** (e.g. `test-key`). The mock agent accepts any value. This field is required because production agents always need authentication.

---

## 7A. Install the Watchtower Agent on Linux

The production Linux path is a one-time installer that sets up a dedicated `watchtower-agent` system user, writes the agent config to `/etc/watchtower-agent/watchtower-agent.env`, installs the runtime into `/opt/watchtower-agent`, creates a `systemd` unit, enables it on boot, and starts it immediately.

Run this on the Docker host:

```sh
curl -fsSL https://your-watchtower-url/watchtower-agent-install.sh -o watchtower-agent-install.sh
sudo WATCHTOWER_AGENT_DOWNLOAD_BASE=https://your-watchtower-url bash ./watchtower-agent-install.sh
```

The installer will prompt for:

- `AGENT_API_KEY`
- `AGENT_PORT` (default `9876`)
- `AGENT_BIND_ADDRESS` (default `0.0.0.0`; use `127.0.0.1` for Cloudflare Tunnel-only setups)
- `DOCKER_SOCKET` (default `/var/run/docker.sock`)

The installer verifies required dependencies (`systemd`, `curl`, `socat`), validates the Docker socket path, and adds the service user to the `docker` group when that group exists.

### Operate the Agent

```sh
sudo systemctl status watchtower-agent
sudo journalctl -u watchtower-agent -f
sudo systemctl restart watchtower-agent
```

### Uninstall the Agent

Preserve config and secrets:

```sh
sudo /opt/watchtower-agent/watchtower-agent-uninstall
```

Delete config and secrets too:

```sh
sudo /opt/watchtower-agent/watchtower-agent-uninstall --purge
```

### Troubleshooting

- `systemctl status watchtower-agent` fails immediately: check `/etc/watchtower-agent/watchtower-agent.env` for a missing API key or invalid port.
- Logs show Docker socket errors: verify `/var/run/docker.sock` exists and that the `watchtower-agent` service user can access it.
- Connection tests fail from the dashboard: verify the reverse proxy or Cloudflare Tunnel points to the configured local agent port.
- Host is tunnel-only: set `AGENT_BIND_ADDRESS=127.0.0.1` in `/etc/watchtower-agent/watchtower-agent.env` and restart the service.

### Non-systemd Hosts

If the host does not run `systemd`, use your existing service manager. If Docker is already your standard service wrapper on that host, run the same `watchtower-agent.sh` script under Docker and configure restart behavior such as `--restart unless-stopped`.

---

## 8. How Polling Works

The host health poller (`/api/host-health-poll`) pings all registered Docker hosts and updates their status in the database. The frontend auto-refreshes every **30 seconds** — no manual action needed after the initial setup.

### In Production (Netlify)

Set up a **Netlify Scheduled Function** or external cron service (e.g. cron-job.org) to hit:

```
GET https://your-site.netlify.app/api/host-health-poll
Header: x-cron-secret: <your HEALTH_POLL_SECRET value>
```

A 60-second interval is recommended.

### In Local Development

The poller does **not** run automatically during `netlify dev`. You have two options:

**Option A — Manual one-shot poll:**
```sh
curl http://localhost:8888/api/host-health-poll -H "x-cron-secret: <your HEALTH_POLL_SECRET>"
```

**Option B — Simple loop (runs every 10 seconds):**
```sh
# PowerShell
while ($true) { Invoke-RestMethod http://localhost:8888/api/host-health-poll -Headers @{"x-cron-secret"="your-secret"}; Start-Sleep 10 }

# Bash / macOS / Linux
while true; do curl -s http://localhost:8888/api/host-health-poll -H "x-cron-secret: your-secret"; sleep 10; done
```

### What Success Looks Like

After polling, a healthy host will show:

| DB Field | Value |
|---|---|
| `status` | `connected` |
| `last_seen_at` | Recent timestamp |
| `consecutive_failures` | `0` |
| `last_error` | `null` |
| `docker_version` | e.g. `27.0.3` |

In the UI, the host row displays a **green "connected" badge**, the Docker version, and the last-seen time. No error text is visible.

If a host fails, `consecutive_failures` increments. After **3 consecutive failures**, status escalates from `error` to `unhealthy` (red badge with error text).

---

## Common Setup Mistakes

| Symptom | Cause | Fix |
|---|---|---|
| `NETLIFY_DATABASE_URL is required` | Missing `.env` or variable not set | Copy `.env.example` to `.env` and fill in all values |
| `init-db.mjs` fails with "relation already exists" | Schema was already applied | Drop the `public` schema in Neon console, then re-run `node netlify/init-db.mjs` |
| App loads but API calls return 401 | `JWT_SECRET` missing or wrong | Ensure `JWT_SECRET` is set in `.env` and restart `netlify dev` |
| Hosts stay "unknown" forever | Poller never ran | The poller doesn't auto-run locally. See [How Polling Works](#8-how-polling-works) |
| "API Key required" toast when adding host | Agent API Key field left blank | Enter any non-empty string for local/mock testing |
| `watchtower-agent` service fails on boot | Missing API key, bad port, or Docker socket path | Run `sudo systemctl status watchtower-agent` and inspect `/etc/watchtower-agent/watchtower-agent.env` |
| Dashboard cannot reach a production host | Agent not exposed through HTTPS or tunnel, or wrong bind address | Check `sudo journalctl -u watchtower-agent -f`, reverse proxy/tunnel config, and `AGENT_BIND_ADDRESS` |
| `netlify dev` fails to start | Port 8888 already in use | Kill any other `netlify dev` process, or check for port conflicts |
| Signup succeeds but login fails | Typo in password during signup | Re-register with a new email or reset the database |

---

## Minimum Successful Install Checklist

Use this after a fresh setup to verify everything works:

- [ ] `npm install` completes without errors
- [ ] `.env` file exists with all four required variables
- [ ] `node netlify/init-db.mjs` prints `✓ Successfully initialized schema`
- [ ] `npx netlify dev` starts without errors, shows "ready on port 8080"
- [ ] http://localhost:8888 loads the landing page
- [ ] Signup with a new email succeeds
- [ ] Login with that email succeeds
- [ ] Organization creation prompt appears and works
- [ ] Adding a host with the mock agent URL succeeds
- [ ] After triggering the poller, the host status becomes "connected" (green badge)
- [ ] The "Last Seen" column shows a recent timestamp

---

## Project Structure

```
├── netlify/
│   ├── functions/         # Netlify serverless functions (API)
│   │   ├── api-docker-hosts.mts      # CRUD for Docker hosts
│   │   ├── api-docker-proxy.mts      # Proxies Docker API calls to agents
│   │   ├── api-host-health-poll.mts  # Scheduled health poller
│   │   ├── api-mock-docker-agent.mts # Built-in mock agent for testing
│   │   ├── auth-login.mts           # JWT authentication
│   │   ├── auth-signup.mts          # User registration
│   │   └── lib/                     # Shared DB + auth helpers
│   ├── schema.sql         # Database schema
│   ├── init-db.mjs        # Schema initialization script
│   └── check-db.mjs       # Quick DB inspection utility
├── src/
│   ├── components/        # React UI components
│   ├── contexts/          # Auth + Organization context providers
│   ├── hooks/             # React Query hooks (useDockerHosts, etc.)
│   ├── pages/             # Route pages (landing, app, auth)
│   ├── services/          # Docker API client
│   └── types/             # TypeScript type definitions
├── netlify.toml           # Netlify build + redirect config
└── .env.example           # Template for environment variables
```

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Query
- **Backend:** Netlify Functions (serverless), Neon Postgres
- **Auth:** JWT (bcrypt password hashing, Bearer token)
- **Deployment:** Netlify (or any platform supporting Netlify Functions)

---

## License

Private — All rights reserved.
