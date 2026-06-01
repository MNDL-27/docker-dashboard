# Graph Report - src/services  (2026-05-12)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 33 nodes · 26 edges · 9 communities (4 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `DockerHostPingResult` - 2 edges
2. `adminApi` - 1 edges
3. `CreateAgentEnrollmentInput` - 1 edges
4. `AgentEnrollmentCreateResponse` - 1 edges
5. `AgentEnrollmentFinalizeResponse` - 1 edges
6. `agentEnrollmentApi` - 1 edges
7. `AlertsSummary` - 1 edges
8. `AlertsWorkspaceResponse` - 1 edges
9. `IncidentsResponse` - 1 edges
10. `alertsApi` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (9 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.33
Nodes (5): agentEnrollmentApi, AgentEnrollmentCreateResponse, AgentEnrollmentFinalizeResponse, CreateAgentEnrollmentInput, DockerHostPingResult

### Community 2 - "Community 2"
Cohesion: 0.4
Nodes (4): alertsApi, AlertsSummary, AlertsWorkspaceResponse, IncidentsResponse

### Community 4 - "Community 4"
Cohesion: 0.5
Nodes (3): WebhookDestinationMutationResponse, webhookDestinationsApi, WebhookDestinationsResponse

## Knowledge Gaps
- **18 isolated node(s):** `adminApi`, `CreateAgentEnrollmentInput`, `AgentEnrollmentCreateResponse`, `AgentEnrollmentFinalizeResponse`, `agentEnrollmentApi` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `adminApi`, `CreateAgentEnrollmentInput`, `AgentEnrollmentCreateResponse` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._