# Graph Report - src/pages/onboarding  (2026-05-12)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 41 nodes · 41 edges · 10 communities (5 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `ErrorBanner()` - 3 edges
2. `ErrorBox()` - 2 edges
3. `CONNECTION_MODES` - 2 edges
4. `checkAuthSyncStatus()` - 2 edges
5. `pollForOrganizationSync()` - 2 edges
6. `useOrganizationSyncEffect()` - 2 edges
7. `useOnboardingState()` - 2 edges
8. `Props` - 1 edges
9. `Props` - 1 edges
10. `Props` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (10 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.24
Nodes (4): ErrorBanner(), ErrorBox(), Props, Props

### Community 1 - "Community 1"
Cohesion: 0.22
Nodes (4): AuthSyncStatus, OnboardingStep, STEPS, SyncPollingResult

### Community 2 - "Community 2"
Cohesion: 0.33
Nodes (3): MODE_ICONS, Props, CONNECTION_MODES

## Knowledge Gaps
- **11 isolated node(s):** `Props`, `Props`, `Props`, `MODE_ICONS`, `Props` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ErrorBanner()` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `Props`, `Props`, `Props` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._