# SaaS Readiness Roadmap — Docker Watchtower Dashboard

> **Generated**: 2026-04-17  
> **Current Status**: Private Beta / Founder-Led Pilot  
> **Target**: Public SaaS Launch  
> **Owner**: Engineering + Product

---

## 🎯 Roadmap Philosophy

**Ship value early, harden incrementally.** Prioritize items that:
1. Unblock revenue collection (billing lifecycle)
2. Prevent abuse or data leaks (entitlements, SSRF)
3. Reduce support burden (onboarding, docs, error handling)
4. Build trust (compliance accuracy, transparency)

---

## 📊 Priority Framework

| Priority | Criteria | Examples |
|----------|----------|----------|
| 🔴 P0 (Blocker) | Prevents revenue, security risk, legal exposure | Billing cancel flow, entitlement enforcement, SSRF mitigation |
| 🟡 P1 (High) | Blocks scale, causes support tickets, UX friction | Invoice history, plan switching, lint/CI fixes |
| 🟢 P2 (Medium) | Nice-to-have for launch, post-launch OK | Audit log UI, Discord notifications, expanded docs |
| 🔵 P3 (Low) | Future enhancements, differentiators | SSO, advanced analytics, mobile app |

---

## 🗓️ Phase 1: Pre-Pilot Hardening (2-3 weeks)
*Goal: Enable safe, manual pilot with 5-10 trusted users*

### 🔴 P0 Items

#### 1.1 Billing Lifecycle Completion
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Implement cancel subscription flow (UI + webhook) | 2-3 days | Backend | User can cancel; webhook updates `subscription_status`; UI reflects change |
| Add invoice history view (Paddle API fetch) | 1-2 days | Frontend | `/app/billing` shows last 3 invoices with download links |
| Handle plan change webhooks (upgrade/downgrade) | 1 day | Backend | Webhook updates `plan` + `paddle_price_id`; entitlements refresh on next request |
| Add customer portal link for payment method updates | 0.5 day | Frontend | "Update payment method" button opens Paddle Customer Portal |

#### 1.2 Server-Side Entitlement Enforcement
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Add `checkEntitlements(orgId, feature)` helper | 1 day | Backend | Helper returns `{ allowed: boolean, reason?: string }` |
| Enforce host limit per plan in `api-docker-hosts.mts` | 0.5 day | Backend | Free tier blocked at 2 hosts; error message is user-friendly |
| Enforce user limit per plan in org invite flow | 0.5 day | Backend | Invite rejected if plan limit exceeded |
| Gate advanced alerts/API access by plan | 0.5 day | Backend | Free tier sees "Upgrade to Pro" CTA instead of feature |

#### 1.3 Content Audit & Placeholder Removal
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Remove or complete `DocsPage.tsx` placeholders | 1 day | Frontend | All nav links work; no "under development" text visible to users |
| Delete redirected legacy routes (Monitoring, Incidents) | 0.5 day | Frontend | 404 or redirect to dashboard; no dead code |
| Audit `SecurityPage.tsx` claims | 0.5 day | Product | Claims match actual controls; add "Coming Soon" badges where needed |

#### 1.4 Launch Ops Foundation
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Fix all lint errors (`npm run lint`) | 1-2 days | Engineering | Zero lint errors; pre-commit hook enabled |
| Add `npm test` with Vitest + basic coverage | 2 days | Engineering | 70%+ coverage on critical paths; CI runs tests |
| Add GitHub Actions workflow (build + test) | 1 day | DevOps | PRs require passing CI; main branch protected |

### 🟡 P1 Items (Parallel Track)

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Add `POST /api/admin/migrate-secrets` endpoint | 1 day | Backend | For encryption key rotation (already documented in README) |
| Improve error messages for entitlement failures | 0.5 day | Frontend | User sees "Upgrade to Pro to add more hosts" not "403" |
| Add onboarding checklist progress indicator | 1 day | Frontend | Visual progress bar for first-time users |

---

## 🗓️ Phase 2: Pilot Launch Prep (1-2 weeks)
*Goal: Enable smooth, low-touch onboarding for pilot users*

### 🔴 P0 Items

#### 2.1 Pilot Onboarding Flow
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Create pilot invite system (email + one-time link) | 2 days | Backend | Admin can generate invite; user lands in pre-configured org |
| Add pilot welcome email template (Netlify Functions + Resend) | 1 day | Backend | Email includes: login link, agent install command, support contact |
| Build pilot feedback collection (in-app + email) | 1 day | Frontend | "Give Feedback" button opens Typeform/Google Form |

#### 2.2 Monitoring & Alerting for Pilot
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Add basic error tracking (Sentry or Logtail) | 1 day | DevOps | Unhandled errors logged with user/org context |
| Set up uptime monitoring for app.dockerdash.app | 0.5 day | DevOps | Ping every 5 min; alert on 2 consecutive failures |
| Create pilot dashboard for admin (active users, errors, feedback) | 2 days | Frontend | `/admin/pilot` shows key metrics; refreshes every 5 min |

### 🟡 P1 Items

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Add rate limiting to public API endpoints | 1 day | Backend | Prevent abuse during pilot; configurable per plan |
| Improve host connection error diagnostics | 1 day | Full-stack | User sees "Agent not reachable: check firewall" not generic error |
| Document pilot runbook (troubleshooting, escalation) | 1 day | Product | Shared doc with support team; updated weekly |

---

## 🗓️ Phase 3: Public Launch Prep (3-4 weeks)
*Goal: Scale to 100+ users with minimal manual intervention*

### 🔴 P0 Items

#### 3.1 Self-Serve Billing & Account Management
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Implement self-serve plan switching (upgrade/downgrade) | 2 days | Full-stack | User selects plan → Paddle checkout → webhook updates org → UI refreshes |
| Add proration logic for mid-cycle changes | 1 day | Backend | Webhook handles `subscription.updated` with proration metadata |
| Build usage dashboard (hosts used, seats used, retention days) | 2 days | Frontend | `/app/billing/usage` shows current usage vs. plan limits |

#### 3.2 Compliance & Trust Foundations
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Add data processing agreement (DPA) page + checkbox at signup | 1 day | Legal + Frontend | Users can download DPA; checkbox required for paid plans |
| Implement basic audit log (org changes, host additions) | 2 days | Backend | `POST /api/audit` endpoint; stored in `audit_log` table |
| Add data export/delete endpoints (GDPR right to access/erasure) | 2 days | Backend | `GET/DELETE /api/me/data` returns/deletes user data |

#### 3.3 Scale & Reliability
| Task | Effort | Owner | Success Criteria |
|------|--------|-------|-----------------|
| Add database connection pooling + retry logic | 1 day | Backend | Handles 10x traffic spike without connection errors |
| Implement graceful degradation for agent polling failures | 1 day | Backend | Poller retries with backoff; UI shows "stale data" warning |
| Add feature flags for gradual rollout | 1 day | DevOps | Can enable new features for % of users via config |

### 🟡 P1 Items

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| Build public status page (uptime, incidents) | 2 days | Frontend | status.dockerdash.app with incident history |
| Add in-app chat support (Crisp or similar) | 1 day | Frontend | Chat widget appears for paid users only |
| Create video onboarding tour | 2 days | Product | 3-min walkthrough for first login |

---

## 🗓️ Phase 4: Post-Launch Growth (Ongoing)
*Goal: Retain users, expand features, optimize conversion*

### 🟢 P2 Items (Post-Launch OK)

| Task | Effort | Owner | Business Impact |
|------|--------|-------|----------------|
| Customer-facing audit log viewer | 2 days | Frontend | Enterprise sales differentiator |
| Discord notification channel | 1 day | Backend | User-requested feature; low effort |
| Expanded help center with search | 3 days | Product | Reduces support tickets by ~30% |
| Tenant-facing secret rotation UI | 1 day | Frontend | Security best practice; builds trust |

### 🔵 P3 Items (Future)

| Task | Effort | Owner | Notes |
|------|--------|-------|-------|
| SSO/SAML for Team/Enterprise plans | 5-7 days | Backend | Enterprise sales requirement |
| Advanced analytics (container trends, cost insights) | 1 week | Full-stack | Premium feature upsell |
| Mobile app (React Native) | 2-3 weeks | Mobile team | User request; low priority vs. web |

---

## 📈 Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| Pre-Pilot | Pilot users onboarded | 5-10 active orgs |
| Pre-Pilot | Billing flow completion rate | >80% of checkout attempts |
| Pilot Launch | Pilot user retention (30-day) | >70% |
| Pilot Launch | Support tickets per user | <0.5/week |
| Public Launch | Conversion (free → paid) | >5% |
| Public Launch | Churn (paid → canceled) | <3%/month |
| Growth | NPS | >40 |
| Growth | Feature adoption (alerts, API) | >50% of paid users |

---

## 🔄 Dependencies & Risks

### Critical Dependencies
- Paddle webhook reliability (monitor + alert on failures)
- Clerk org sync (ensure `organization.created` events trigger DB setup)
- Neon Postgres connection limits (monitor + alert on pool exhaustion)

### Key Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Entitlement bypass via API | High | Add integration tests for all feature endpoints; add request logging |
| Billing webhook failures | High | Add dead-letter queue; manual reconciliation script |
| SSRF via host_url | Critical | Keep `host-url.mts` validation; add e2e test for malicious URLs |
| Compliance claim liability | Medium | Legal review of all public-facing claims; add "subject to" disclaimers |

---

## 🎯 Next Immediate Actions (This Week)

1. [ ] **Fix lint errors** — Unblock CI/CD pipeline
2. [ ] **Implement cancel subscription flow** — Unblock pilot billing
3. [ ] **Add server-side host limit check** — Prevent free-tier abuse
4. [ ] **Audit SecurityPage claims** — Reduce legal risk
5. [ ] **Create pilot invite system** — Enable manual onboarding

---

> 💡 **Pro Tip**: Use this roadmap as a living document. Update priorities weekly based on pilot feedback. Tag each completed item with `✅ [date]` and link to the PR/commit.

---

*Last updated: 2026-04-17*  
*Next review: 2026-04-24*
