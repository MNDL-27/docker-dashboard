# Graph Report - src/lib  (2026-05-12)

## Corpus Check
- Corpus is ~3,697 words - fits in a single context window. You may not need a graph.

## Summary
- 78 nodes · 108 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

## God Nodes (most connected - your core abstractions)
1. `sanitizeConnectionError()` - 8 edges
2. `normalizeHostStatus()` - 6 edges
3. `isLocalDev()` - 6 edges
4. `summarizeApiErrorText()` - 5 edges
5. `isNetlifyPreview()` - 5 edges
6. `buildApiErrorMessage()` - 4 edges
7. `getClerkSessionToken()` - 4 edges
8. `isUnhealthyHostStatus()` - 4 edges
9. `getHostAlertCopy()` - 4 edges
10. `apiFetch()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (11 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (16): AGENT_AUTH_PATTERNS, CLOUDFLARE_PATTERNS, DOCKER_SOCKET_PATTERNS, DOCKERDASH_EDGE_PATTERNS, isAgentAuthError(), isCloudflareError(), isDockerdashEdgeError(), isDockerSocketError() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.19
Nodes (14): ApiError, ApiErrorBody, apiFetch(), ApiFetchOptions, buildApiErrorMessage(), ClerkGlobal, ClerkSession, decodeHtmlEntities() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.35
Nodes (6): getHostAlertCopy(), getHostStatusAppearance(), isReadableHostStatus(), isUnhealthyHostStatus(), NormalizedHostStatus, normalizeHostStatus()

### Community 3 - "Community 3"
Cohesion: 0.47
Nodes (8): getAppOrigin(), getPublicOrigin(), isAppHost(), isAppSubdomain(), isDocsSubdomain(), isLocalDev(), isNetlifyPreview(), isPreviewAuthBypassEnabled()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (4): buildDashboardStats(), DashboardStats, normalizeDashboardContainers(), RawContainer

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (3): pricingComparisonRows, PricingPlan, pricingPlans

## Knowledge Gaps
- **20 isolated node(s):** `fetchMock`, `ClerkSession`, `ClerkGlobal`, `ApiErrorBody`, `ApiFetchOptions` (+15 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `fetchMock`, `ClerkSession`, `ClerkGlobal` to the rest of the system?**
  _20 weakly-connected nodes found - possible documentation gaps or missing edges._