# Integrations

## Core Platform Integrations

- **Clerk:** Identity provider. Handles JWT-based authentication, user sessions, and organization-based multi-tenancy. Webhooks from Clerk (`api-clerk-webhook.mts`) are used to sync state.
- **Neon Postgres:** Serverless database connection. Used directly within Netlify functions via the HTTP driver.
- **Docker Engine API:** Indirect integration via the host agent. The agent proxies HTTP calls (like `/_ping`, `/containers/json`) to the local Docker Unix socket.
- **Slack (Destinations):** Webhook destinations for alerting. Handled via `api-slack-destinations.mts`.

## API Designer Analysis

The integrations rely on standard OAuth/JWT mechanisms (Clerk) and tokenized proxy authentication (X-Agent-Key). 
- **Webhook Handlers:** Incoming webhooks (like Clerk or Billing) lack formalized signature verification schemas consistently documented for API developers.
- **Docker Representation:** The backend API closely mirrors Docker's own Engine API but lacks a canonical abstraction, leading to tight coupling with Docker's specific JSON shapes rather than domain-specific resource models.
