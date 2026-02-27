# Summary 04-02: Alert Evaluation Engine & Webhooks

**Status:** ✅ Complete
**Duration:** ~5 min

## What Was Done

### Task 1: Webhook API Routes
- Created `apps/api/src/routes/webhooks.ts` with full CRUD:
  - `GET /api/webhooks` — list org webhooks (any member)
  - `POST /api/webhooks` — create (ADMIN+)
  - `PUT /api/webhooks/:id` — update URL/secret/isActive (ADMIN+)
  - `DELETE /api/webhooks/:id` — delete (ADMIN+)

### Task 2: Background Alert Engine Service
- Created `apps/api/src/services/alertEngine.ts`
- 60-second evaluation interval started on server boot
- Evaluates all conditions: CONTAINER_DOWN, RESTART_LOOP, CPU_USAGE, MEMORY_USAGE
- Fires new alerts with deduplication (one FIRING per rule+container)
- Resolves alerts when condition clears

### Task 3: Webhook Dispatcher
- Integrated into alertEngine.ts
- Fetches active webhooks for the org
- POSTs JSON payload with event, alert_id, rule_name, container_name, host_name, timestamp
- Includes `X-Docker-Dashboard-Signature` HMAC SHA-256 header when secret configured

### Additionally Created: Alert Rules API
- Created `apps/api/src/routes/alerts.ts` with:
  - `GET /api/alerts` — list alerts with rule/container details
  - `GET /api/alerts/rules` — list rules with alert counts
  - `POST /api/alerts/rules` — create rule (ADMIN+)
  - `PUT /api/alerts/rules/:id` — update (ADMIN+)
  - `DELETE /api/alerts/rules/:id` — delete (ADMIN+, cascades alerts)

## Files Created
- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/routes/alerts.ts`
- `apps/api/src/services/alertEngine.ts`

## Files Modified
- `apps/api/src/index.ts` — mounted routes + startAlertEngine()

## Verification
- [x] `npx tsc --noEmit` passes
- [x] All routes mounted in index.ts
- [x] Alert engine starts on server boot
