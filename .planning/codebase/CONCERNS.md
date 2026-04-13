# Concerns

As an API Designer, several structural concerns threaten scalability and developer experience:

## 1. Lack of Formal API Specifications (OpenAPI)
The lack of a centralized OpenAPI 3.1 specification means the API contract is implicit. SDK generation, automated docs, and contract testing are impossible in the current state.

## 2. Inconsistent Error Handling & Pagination
Responses do not adhere to standardized error shapes (RFC 7807). Operations returning lists (e.g., Logs or Containers) lack cursor-based or limit/offset pagination, leading to potential performance bottlenecks as fleets grow.

## 3. Brittle Host Agent Proxying
The `watchtower-agent.sh` relies on plain `grep` and HTTP piping without validating the JSON payload structure. Edge functions depend on the exact shape of the Docker Engine API bleeding through the agent.

## 4. No Support for Bulk Operations or Advanced Querying
There are no dedicated bulk APIs for managing large fleets. API optimization methods like GraphQL Federation are noticeably absent despite the highly relational nature of the Dashboard (User -> Org -> Hosts -> Containers -> Metrics), which currently forces the frontend to piece together relationships via multiple naive REST `fetch` calls.

## 5. Security Contexts & Rate Limiting
No explicit API rate limiting or caching headers (`Cache-Control`) are enforced at the API layer, leaving the system vulnerable to DDOS or excessively expensive database polling.

## 6. Deprecation Policies & Versioning
There is no active API versioning strategy (e.g., `/v1/`, `Accept: application/vnd...`), making backward compatibility difficult to ensure if the data models change.
