# Plan 01-01 Summary

- Added one-command SaaS-local bootstrap at `npm run dev:saas-local` via `scripts/dev-saas-local.mjs`.
- Added deterministic local schema+seed flow via `scripts/seed-saas-local.mjs` and `prisma/seed-local.ts`.
- Wired seeded agent token (`dev-local-agent-token`) into `docker-compose.dev.yml` with explicit local env defaults.
- Preserved self-hosted lane with explicit root scripts: `mode:selfhosted:up` and `mode:selfhosted:down`.
