# Architecture

## API-First Perspective

Docker Watchtower Dashboard is a distributed system spanning browser, edge compute, and on-premise hosts.

### 1. Browser to Edge API (Frontend -> Netlify)
The React SPA communicates with the Netlify Edge Functions via JSON-based HTTP requests securely authenticated with Clerk Bearer tokens (JWT).
- **Semantics:** Relies on basic GET/POST/PUT/DELETE, though resource naming is sometimes inconsistent (e.g., `/api/docker-proxy`).
- **Data Fetching:** TanStack Query is used, but there's no typed API client (like an OpenAPI fetch client or tRPC), leading to potential type drift.
- **Pagination:** Coarse or nonexistent. Endpoints often return full arrays instead of utilizing cursor-based or limit/offset pagination strategies.

### 2. Edge API to Database (Netlify -> Neon)
Direct SQL queries using the `@neondatabase/serverless` client. There is no ORM. Tenancy is maintained by injecting the resolved internal Clerk Organization ID into queries.

### 3. Edge API to Host Agent (Netlify -> Watchtower Agent)
The Edge functions talk to the on-prem host agent via plain HTTP. 
- **Authentication:** Enforced via `X-Agent-Key` header API keys.
- **Payload:** The agent essentially proxies the raw Docker response. It lacks a formal API translation layer, thus Docker API versioning issues directly bubble up to the Edge API layer.

## Future API Evolution Strategy
To align with Senior API standards:
1. **OpenAPI 3.1 Def:** The `/api/*` surface should be formally specified to generate clients, automate Postman collections, and ensure structural integrity.
2. **GraphQL Consideration:** Since the frontend heavily aggregates data (hosts, containers, metrics), introducing GraphQL or Apollo could optimize over-fetching out of the current REST APIs.
3. **Structured Errors:** Ensure predictable error objects spanning `{ code, message, details }` using standard HTTP statuses (e.g., RFC 7807 Problem Details).
