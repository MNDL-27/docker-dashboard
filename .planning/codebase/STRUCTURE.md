# Structure

## Directory Map

- **`src/`**: Frontend React application.
  - `pages/`: Route handlers.
  - `components/`: UI and feature components.
  - `services/` & `hooks/`: API interaction layer. Contains thin wrappers like `docker-api.ts`.
- **`netlify/functions/`**: The core API layer. 
  - Each `api-*.mts` represents a distinct API operational domain or webhook receiver.
  - `lib/`: Shared API utilities (Auth middleware, Crypto for secret management).
- **`public/`**: Contains the bash-based API agent (`watchtower-agent.sh`).
- **`db-migrations/`**: Neon Postgres database schemas.

## API Designer Analysis
The flat layout inside `netlify/functions` represents a monolithic approach to serverless functions. Re-organizing into domain-specific folders (e.g., `netlify/functions/v1/hosts/`, `netlify/functions/v1/containers/`) would greatly improve discoverability, routing consistency, and versioning.
