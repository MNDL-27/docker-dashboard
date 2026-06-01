# Graph Report - netlify/functions/lib  (2026-05-12)

## Corpus Check
- Corpus is ~1,039 words - fits in a single context window. You may not need a graph.

## Summary
- 22 nodes · 13 edges · 10 communities (7 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]

## God Nodes (most connected - your core abstractions)
1. `staleCutoffDate()` - 2 edges
2. `shouldMarkHostStale()` - 2 edges
3. `tpl` - 1 edges
4. `tpl` - 1 edges
5. `mockedSql` - 1 edges
6. `req` - 1 edges
7. `headers` - 1 edges
8. `warnSpy` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (10 total, 3 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.4
Nodes (4): headers, mockedSql, req, warnSpy

## Knowledge Gaps
- **6 isolated node(s):** `tpl`, `tpl`, `mockedSql`, `req`, `headers` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `tpl`, `tpl`, `mockedSql` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._