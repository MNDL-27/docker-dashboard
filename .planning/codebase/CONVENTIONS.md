# Conventions

## API & Gateway Conventions

- **Authentication:** All secure endpoints invoke `requireAuth` from `lib/auth.mts` to decode OAuth 2.0 JWTs from Clerk. Public endpoints are explicitly unprotected.
- **HTTP Middlewares:** Minimal. CORS and JSON headers are defined iteratively per file rather than through a global API Gateway middleware.
- **Response Format:** Returns plain JSON objects, but the exact structure frequently varies depending on the author (e.g., returning `{ data: ... }` vs just arrays `[...]` vs `{ success: true }`).
- **Versioning:** URI versioning (e.g., `/api/v1/`) is notably absent. Current routes reside natively at the root `/api/`.

## Quality & Consistency Standards

- **Error Handling:** Ad-hoc. Responses often fallback to a generic 500 or 400 with a custom `{ error: string }` object. A standardized API error catalog with actionable codes is currently missing.
- **TypeScript:** The boundary between the API and Frontend is weakly typed. The frontend casts `as any` or relies on manually synchronized types rather than generated types from an OpenAPI specification footprint.
- **Documentation:** Inline comments are minimal. Developer experience (DX) relies heavily on traversing source files instead of browsing generated Swagger or Redoc UI.
