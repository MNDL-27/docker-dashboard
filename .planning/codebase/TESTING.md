# Testing

## Current Test Strategy

- **Mocking at the Edge:** `api-mock-docker-agent.mts` exists to simulate host agent responses for development/testing without needing a live Docker environment.
- **Frontend Testing:** Minimal or absent. There is a lack of deep E2E or unit testing verifying the React Query data fetching behaviors or mocking the API gateway responses.

## API Designer Analysis

For a production-grade API architecture:
- **Contract Testing:** The lack of OpenAPI specifications prevents Automated Contract Testing between the Edge functions and the Frontend.
- **Postman/Insomnia Collections:** No standardized collection is provided for developer onboarding or E2E validation against the Edge.
- **Integration Testing:** Needs automated integration suites to test Netlify Edge -> Neon -> Clerk Webhooks effectively, bypassing brittle manual validation.
