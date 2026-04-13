# Stack

## Current Technology Stack

- **Frontend:** React, React Router, Vite, Tailwind CSS, shadcn/ui.
- **Backend API Layer:** Netlify Edge Functions (`.mts`). Serves as the API gateway and control plane.
- **Database:** Neon Serverless Postgres.
- **Authentication:** Clerk for user identity and organization tenancy.
- **Host Agent:** Bash-based agent (`watchtower-agent.sh`) serving as a local API proxy to the Docker socket.

## API Designer Analysis

The current stack relies on Netlify Edge Functions to expose a REST-ish API consumed by the React app. However, from a structural API-first perspective:
- Lack of a unified API schema or framework (e.g., OpenAPI auto-generation, Fastify, tRPC, or GraphQL). Each `.mts` file routes requests ad-hoc.
- Database access is direct via `neon-http` inside the API layer, bypassing a formal data abstraction layer.
- Agent interactions use raw `curl`/`socat` proxying, forming an internal microservice API that is brittle (relying on grep/sed for JSON processing).
